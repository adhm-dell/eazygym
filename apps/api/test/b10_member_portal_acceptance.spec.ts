import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Phase 09: Member Portal Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let memberToken = "";
  let memberId = "";
  let memberPhone = "01011122233";

  let otherMemberToken = "";
  let otherMemberId = "";
  let otherMemberPhone = "01012345671";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    server = app.getHttpServer();
    prisma = app.get(PrismaService);

    // 1. Login primary test member (Mohamed Ahmed - 100245)
    const loginRes = await request(server)
      .post("/api/v1/auth/member/login")
      .send({ phone: memberPhone, password: "123456" });

    expect([200, 201]).toContain(loginRes.status);
    expect(loginRes.body.accessToken).toBeDefined();
    memberToken = loginRes.body.accessToken;
    memberId = loginRes.body.member.id;

    // 2. Switch to second member (Ahmed Ali - 100101)
    const switchRes = await request(server)
      .post("/api/v1/auth/switch")
      .send({ memberPhone: otherMemberPhone });

    expect([200, 201]).toContain(switchRes.status);
    otherMemberToken = switchRes.body.accessToken;
    otherMemberId = switchRes.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Authentication & Profile: Member can login and access their profile via /me", async () => {
    const meRes = await request(server)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.member.id).toBe(memberId);
    expect(meRes.body.member.role).toBe("MEMBER");
    expect(meRes.body.member.code).toBe("100245");
  });

  it("2. Data Isolation: Member can ONLY see their own subscriptions (cannot see other members')", async () => {
    const subsRes = await request(server)
      .get("/api/v1/subscriptions")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(subsRes.status).toBe(200);
    expect(Array.isArray(subsRes.body)).toBe(true);

    // All returned subscriptions MUST belong to memberId
    for (const sub of subsRes.body) {
      expect(sub.member.id).toBe(memberId);
    }

    // Try explicitly querying another member's subscriptions
    const hackedRes = await request(server)
      .get(`/api/v1/subscriptions?memberId=${otherMemberId}`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(hackedRes.status).toBe(200);
    // Should still only return logged-in member's subscriptions
    for (const sub of hackedRes.body) {
      expect(sub.member.id).toBe(memberId);
      expect(sub.member.id).not.toBe(otherMemberId);
    }
  });

  it("3. Wallet Access: Member can view their wallet balance and transaction ledger", async () => {
    const walletRes = await request(server)
      .get(`/api/v1/members/${memberId}/wallet`)
      .set("Authorization", `Bearer ${memberToken}`);

    expect(walletRes.status).toBe(200);
    expect(walletRes.body.balance).toBeDefined();
    expect(Array.isArray(walletRes.body.transactions)).toBe(true);
  });

  it("4. Group Classes: Member can view today's classes and weekly schedule", async () => {
    const todayRes = await request(server)
      .get("/api/v1/classes/today")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(todayRes.status).toBe(200);
    expect(Array.isArray(todayRes.body)).toBe(true);

    const schedulesRes = await request(server)
      .get("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${memberToken}`);

    expect(schedulesRes.status).toBe(200);
    expect(Array.isArray(schedulesRes.body)).toBe(true);
  });

  it("5. Freeze Flow: Enforces plan freeze limits and rules exactly", async () => {
    // Fetch member's subscriptions
    const subsRes = await request(server)
      .get("/api/v1/subscriptions")
      .set("Authorization", `Bearer ${memberToken}`);

    let activeSub = subsRes.body.find(
      (s: any) => s.status === "ACTIVE" && (s.freezeRemainingCount ?? 0) > 0
    );
    if (!activeSub) {
      activeSub = subsRes.body.find((s: any) => s.status === "ACTIVE");
      if (activeSub) {
        await prisma.subscription.update({
          where: { id: activeSub.id },
          data: {
            freezeMaxCount: 2,
            freezeMaxTotalDays: 15,
            freezeUsedDays: 0,
          },
        });
      }
    }
    if (!activeSub) return;

    // Test: Requesting freeze exceeding allowed remaining days should fail
    const invalidFreeze = await request(server)
      .post(`/api/v1/subscriptions/${activeSub.id}/freeze`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ days: 100, reason: "إجازة طويلة جداً" });

    expect([400, 422]).toContain(invalidFreeze.status);

    // Test: Valid freeze
    const validFreeze = await request(server)
      .post(`/api/v1/subscriptions/${activeSub.id}/freeze`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ days: 3, reason: "إجازة عمل" });

    expect([200, 201]).toContain(validFreeze.status);
    expect(validFreeze.body.subscriptionId).toBe(activeSub.id);

    // Verify subscription status is now FROZEN
    const frozenSubs = await request(server)
      .get("/api/v1/subscriptions")
      .set("Authorization", `Bearer ${memberToken}`);
    const updatedSub = frozenSubs.body.find((s: any) => s.id === activeSub.id);
    expect(updatedSub.status).toBe("FROZEN");

    // Test: Second freeze while already frozen should be rejected
    const secondFreeze = await request(server)
      .post(`/api/v1/subscriptions/${activeSub.id}/freeze`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ days: 3, reason: "تجميد إضافي" });

    expect([400, 409, 422]).toContain(secondFreeze.status);

    // Test: Unfreeze by member
    const unfreezeRes = await request(server)
      .post(`/api/v1/subscriptions/${activeSub.id}/unfreeze`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ note: "استئناف التمرين" });

    expect([200, 201]).toContain(unfreezeRes.status);
    expect(unfreezeRes.body.success).toBe(true);
    expect(unfreezeRes.body.status).toBe("ACTIVE");
  });
});
