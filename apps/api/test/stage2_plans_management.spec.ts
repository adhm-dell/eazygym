import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Stage 2: Plans Management Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let adminToken = "";
  let receptionToken = "";
  let gymId = "";

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

    // Login Admin
    const adminLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@powercore.gym", password: "123456" });
    adminToken = adminLogin.body.accessToken;
    gymId = adminLogin.body.user.gymId;

    // Login Reception
    const recLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "reception@powercore.gym", password: "123456" });
    receptionToken = recLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Acceptance: Create a PT plan with commissionMilestones greater than duration months returns 400 with field error", async () => {
    // 30 days = 1 month, commissionMilestones: 4 is invalid (> 1)
    const res = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "خطة تدريب غير صالحة",
        kind: "PT",
        price: 300000,
        durationDays: 30,
        commissionMilestones: 4,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PLAN");
    expect(res.body.details?.fields).toContain("commissionMilestones");
  });

  it("2. Acceptance: Edit plan price does NOT mutate existing member subscription price (immutable snapshot)", async () => {
    // 1. Create a unique plan
    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة تجريبية ثابتة ${Date.now()}`,
        kind: "GYM",
        price: 200000, // 2,000 EGP (200,000 piasters)
        durationDays: 30,
        grantsFloorAccess: true,
      });
    expect(planRes.status).toBe(201);
    const testPlan = planRes.body;

    // 2. Create a member
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: `عضو اختبار السعر ${Date.now()}`,
        phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
        code: `M-PRC-${Date.now().toString().slice(-5)}`,
      });
    expect(memRes.status).toBe(201);
    const member = memRes.body;

    // 3. Member purchases the subscription at 2,000 EGP
    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: testPlan.id,
            quantity: 1,
          },
        ],
        payments: [{ method: "CASH", amount: 200000 }],
      });
    expect(invoiceRes.status).toBe(201);

    // Verify subscription created with price = 200000 piasters (2000.00 decimal in DB)
    const subscriptionBefore = await prisma.subscription.findFirst({
      where: { memberId: member.id, planId: testPlan.id },
    });
    expect(subscriptionBefore).toBeTruthy();
    expect(Number(subscriptionBefore!.price)).toBe(2000);

    // 4. Admin edits the plan price to 3,500 EGP (350,000 piasters)
    const editRes = await request(server)
      .patch(`/api/v1/plans/${testPlan.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        price: 350000,
      });
    expect(editRes.status).toBe(200);
    expect(editRes.body.price).toBe(350000);

    // 5. Open member subscriptions: their price is UNCHANGED (still 2000)
    const subscriptionAfter = await prisma.subscription.findFirst({
      where: { memberId: member.id, planId: testPlan.id },
    });
    expect(subscriptionAfter).toBeTruthy();
    expect(Number(subscriptionAfter!.price)).toBe(2000);

    // Verify member portal/subscriptions endpoint also returns original price
    const memberSubsRes = await request(server)
      .get(`/api/v1/subscriptions?memberId=${member.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(memberSubsRes.status).toBe(200);
    const memberSub = memberSubsRes.body.find((s: any) => s.id === subscriptionBefore!.id);
    expect(memberSub).toBeTruthy();
    expect(memberSub.price).toBe(200000); // 2,000.00 EGP in piasters
  });

  it("3. Acceptance: An archived plan no longer appears in POS active plans, and admin can restore it", async () => {
    // 1. Create a plan
    const createRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة للأرشفة ${Date.now()}`,
        kind: "CLASS",
        price: 150000,
        durationDays: 30,
        sessionsPerWeek: 3,
        totalSessions: 12,
      });
    expect(createRes.status).toBe(201);
    const planId = createRes.body.id;

    // 2. Verify it is visible in POS query (/plans?active=true)
    let posPlans = await request(server)
      .get("/api/v1/plans?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(posPlans.status).toBe(200);
    expect(posPlans.body.some((p: any) => p.id === planId)).toBe(true);

    // 3. Admin archives the plan
    const archiveRes = await request(server)
      .post(`/api/v1/plans/${planId}/archive`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(archiveRes.status).toBe(201);

    // 4. Verify it no longer appears in POS (/plans?active=true)
    posPlans = await request(server)
      .get("/api/v1/plans?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(posPlans.status).toBe(200);
    expect(posPlans.body.some((p: any) => p.id === planId)).toBe(false);

    // 5. Admin restores the plan
    const restoreRes = await request(server)
      .post(`/api/v1/plans/${planId}/restore`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(restoreRes.status).toBe(201);

    // 6. Verify it reappears in POS
    posPlans = await request(server)
      .get("/api/v1/plans?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(posPlans.status).toBe(200);
    expect(posPlans.body.some((p: any) => p.id === planId)).toBe(true);
  });

  it("4. Acceptance: RECEPTION cannot modify or archive plans (RBAC returns 403 Forbidden)", async () => {
    // RECEPTION trying to create a plan -> 403 Forbidden
    const createRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "محاولة اختراق باقة",
        kind: "GYM",
        price: 100000,
        durationDays: 30,
      });
    expect(createRes.status).toBe(403);

    // RECEPTION trying to patch a plan -> 403 Forbidden
    const patchRes = await request(server)
      .patch("/api/v1/plans/plan_gym_1m")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ price: 999 });
    expect(patchRes.status).toBe(403);

    // RECEPTION trying to archive a plan -> 403 Forbidden
    const archiveRes = await request(server)
      .post("/api/v1/plans/plan_gym_1m/archive")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(archiveRes.status).toBe(403);

    // RECEPTION trying to restore a plan -> 403 Forbidden
    const restoreRes = await request(server)
      .post("/api/v1/plans/plan_gym_1m/restore")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(restoreRes.status).toBe(403);
  });
});
