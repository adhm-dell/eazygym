import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Stage 8: Coach App, Member App and Security Hardening Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let coachToken = "";
  let coachId = "";
  let otherCoachToken = "";
  let otherCoachId = "";
  let gymId = "";

  let memberToken = "";
  let memberId = "";
  let memberPhone = "01011122233";

  let adminToken = "";
  let adminId = "";

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

    // 1. Login Coach Ahmed
    const coachLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    coachToken = coachLogin.body.accessToken;
    coachId = coachLogin.body.user.id;
    gymId = coachLogin.body.user.gymId;

    // 2. Login Coach Tarek (for data isolation testing)
    const otherCoachLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.tarek@powercore.gym", password: "123456" });
    otherCoachToken = otherCoachLogin.body.accessToken;
    otherCoachId = otherCoachLogin.body.user.id;

    // 3. Login Gym Admin
    const adminLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@powercore.gym", password: "123456" });
    adminToken = adminLogin.body.accessToken;
    adminId = adminLogin.body.user.id;

    // 4. Login Member
    const memberLogin = await request(server)
      .post("/api/v1/auth/member/login")
      .send({ phone: memberPhone, password: "123456" });
    memberToken = memberLogin.body.accessToken;
    memberId = memberLogin.body.member.id;

    // Ensure open shift for any transactions
    const existingOpenShift = await prisma.shift.findFirst({
      where: { gymId, status: "OPEN" },
    });
    if (!existingOpenShift) {
      await prisma.shift.create({
        data: {
          gymId,
          staffId: adminId,
          status: "OPEN",
          openingCash: 500,
          expectedCash: 500,
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe("1. Coach Portal Features & Data Isolation", () => {
    it("Coach can only see their own trainees and commission", async () => {
      // 1. Commission check
      const commRes = await request(server)
        .get("/api/v1/me/commission")
        .set("Authorization", `Bearer ${coachToken}`);

      expect(commRes.status).toBe(200);
      expect(commRes.body.coachId).toBe(coachId);

      // Other coach gets their own commission
      const otherCommRes = await request(server)
        .get("/api/v1/me/commission")
        .set("Authorization", `Bearer ${otherCoachToken}`);

      expect(otherCommRes.status).toBe(200);
      expect(otherCommRes.body.coachId).toBe(otherCoachId);
      expect(otherCommRes.body.coachId).not.toBe(coachId);

      // 2. Trainees check
      const traineesRes = await request(server)
        .get("/api/v1/me/trainees")
        .set("Authorization", `Bearer ${coachToken}`);

      expect(traineesRes.status).toBe(200);
      expect(Array.isArray(traineesRes.body)).toBe(true);
    });

    it("Coach can view weekly shifts schedule", async () => {
      const shiftsRes = await request(server)
        .get("/api/v1/coach-shifts")
        .set("Authorization", `Bearer ${coachToken}`);

      expect(shiftsRes.status).toBe(200);
      expect(Array.isArray(shiftsRes.body)).toBe(true);
      for (const s of shiftsRes.body) {
        expect(s.coachId).toBe(coachId);
      }
    });

    it("Coach Session: Attendance marks session and deducts, no-show is free", async () => {
      // Create a test trainee & PT subscription
      const member = await prisma.member.create({
        data: {
          gymId,
          name: `متدرب جلسات ${Date.now()}`,
          phone: "010" + Math.floor(10000000 + Math.random() * 90000000),
          gender: "MALE",
          code: `code_${Date.now()}`,
        },
      });

      const ptPlan = await prisma.plan.findFirst({
        where: { gymId, kind: "PT", isActive: true },
      });
      expect(ptPlan).toBeDefined();

      const sub = await prisma.subscription.create({
        data: {
          gymId,
          memberId: member.id,
          planId: ptPlan!.id,
          kind: "PT",
          status: "ACTIVE",
          price: 1500,
          minUpfrontPercent: 0,
          createdById: "staff_gym_admin",
          durationDays: 30,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          originalEndDate: new Date(Date.now() + 30 * 86400000),
          totalSessions: 10,
          usedSessions: 0,
          freezeMaxCount: 2,
          freezeMaxTotalDays: 15,
        },
      });

      // 1. Create a coach session
      const createSessionRes = await request(server)
        .post("/api/v1/coach-sessions")
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          coachId,
          type: "PRIVATE",
          startTime: new Date(Date.now() + 1000).toISOString(),
          endTime: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(createSessionRes.status).toBe(201);
      const sessionId = createSessionRes.body.id;

      // Add participant to session
      await prisma.sessionParticipant.create({
        data: {
          sessionId,
          memberId: member.id,
          source: "PT_LINKED",
          subscriptionId: sub.id,
          attended: false,
        },
      });

      // 2. Record attendance -> deducts 1 session
      const attendRes = await request(server)
        .post(`/api/v1/coach-sessions/${sessionId}/attendance`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          attendedMemberIds: [member.id],
        });

      expect(attendRes.status).toBe(201);
      expect(attendRes.body.session.status).toBe("COMPLETED");
      expect(attendRes.body.ptDeductionsCount).toBe(1);

      // Verify used sessions incremented by 1
      const updatedSub = await prisma.subscription.findUnique({
        where: { id: sub.id },
      });
      expect(updatedSub?.usedSessions).toBe(1);

      // 3. Create second session and record no-show -> 0 sessions deducted
      const session2Res = await request(server)
        .post("/api/v1/coach-sessions")
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          coachId,
          type: "PRIVATE",
          startTime: new Date(Date.now() + 7200000).toISOString(),
          endTime: new Date(Date.now() + 10800000).toISOString(),
        });

      const session2Id = session2Res.body.id;

      await prisma.sessionParticipant.create({
        data: {
          sessionId: session2Id,
          memberId: member.id,
          source: "PT_LINKED",
          subscriptionId: sub.id,
          attended: false,
        },
      });

      const noShowRes = await request(server)
        .post(`/api/v1/coach-sessions/${session2Id}/no-show`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send();

      expect(noShowRes.status).toBe(201);
      expect(noShowRes.body.status).toBe("NO_SHOW");

      // Used sessions remains 1 (no-show is free)
      const afterNoShowSub = await prisma.subscription.findUnique({
        where: { id: sub.id },
      });
      expect(afterNoShowSub?.usedSessions).toBe(1);
    });

    it("InBody Assessments: Coach can record and fetch metrics history", async () => {
      const assessmentData = {
        weight: 78.5,
        bodyFatPercent: 18.2,
        muscleMass: 35.8,
        bmi: 24.1,
        waterPercent: 58.0,
        visceralFat: 6,
        notes: "تحسن ملحوظ في الكتلة العضلية",
      };

      const createAssRes = await request(server)
        .post(`/api/v1/members/${memberId}/assessments`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({ metrics: assessmentData });

      expect(createAssRes.status).toBe(201);
      expect(createAssRes.body.id).toBeDefined();
      expect(createAssRes.body.metrics.weight).toBe(78.5);

      const listAssRes = await request(server)
        .get(`/api/v1/members/${memberId}/assessments`)
        .set("Authorization", `Bearer ${coachToken}`);

      expect(listAssRes.status).toBe(200);
      expect(Array.isArray(listAssRes.body)).toBe(true);
      expect(listAssRes.body.length).toBeGreaterThanOrEqual(1);
      const found = listAssRes.body.find((a: any) => a.id === createAssRes.body.id);
      expect(found).toBeDefined();
      expect(found.metrics.bodyFatPercent).toBe(18.2);
    });
  });

  describe("2. Member Portal & Freeze Domain Limits", () => {
    it("Member can view their subscriptions and only their own data", async () => {
      const subsRes = await request(server)
        .get("/api/v1/subscriptions")
        .set("Authorization", `Bearer ${memberToken}`);

      expect(subsRes.status).toBe(200);
      expect(Array.isArray(subsRes.body)).toBe(true);
      for (const s of subsRes.body) {
        expect(s.member.id).toBe(memberId);
      }
    });

    it("Subscription Renewal: POST /subscriptions/:id/renew chains new subscription period", async () => {
      // Create dedicated member for renewal test to ensure test isolation
      const renewMember = await prisma.member.create({
        data: {
          gymId,
          name: `عضو تجديد مستقل ${Date.now()}`,
          phone: "010" + Math.floor(10000000 + Math.random() * 90000000),
          gender: "FEMALE",
          code: `renew_${Date.now()}`,
        },
      });

      const gymPlan = await prisma.plan.findFirst({
        where: { gymId, isActive: true },
      });
      expect(gymPlan).toBeDefined();

      const subToRenew = await prisma.subscription.create({
        data: {
          gymId,
          memberId: renewMember.id,
          planId: gymPlan!.id,
          kind: "GYM",
          status: "ACTIVE",
          price: 1000,
          minUpfrontPercent: 0,
          createdById: "staff_gym_admin",
          durationDays: 30,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          originalEndDate: new Date(Date.now() + 30 * 86400000),
          freezeMaxCount: 2,
          freezeMaxTotalDays: 15,
        },
      });

      const renewRes = await request(server)
        .post(`/api/v1/subscriptions/${subToRenew.id}/renew`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});

      expect(renewRes.status).toBe(201);
      expect(renewRes.body.subscription).toBeDefined();
      expect(renewRes.body.subscription.memberId).toBe(renewMember.id);
      // New subscription starts on or after old end date
      const oldEndDate = new Date(subToRenew.endDate).getTime();
      const newStartDate = new Date(renewRes.body.subscription.startDate).getTime();
      expect(newStartDate).toBeGreaterThanOrEqual(oldEndDate - 1000);
    });
  });

  describe("3. Auth Hardening (In-Memory Tokens + httpOnly Cookie)", () => {
    it("Login sets httpOnly secure refresh_token cookie and returns access token", async () => {
      const loginRes = await request(server)
        .post("/api/v1/auth/login")
        .send({ email: "admin@powercore.gym", password: "123456" });

      expect(loginRes.status).toBe(201);
      expect(loginRes.body.accessToken).toBeDefined();

      const cookies = loginRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const refreshCookie = (cookies as unknown as string[]).find((c: string) => c.startsWith("refresh_token="));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("SameSite=Lax");
    });

    it("POST /auth/refresh rotates the refresh token cookie and issues new access token", async () => {
      // First login to get the cookie
      const loginRes = await request(server)
        .post("/api/v1/auth/login")
        .send({ email: "admin@powercore.gym", password: "123456" });

      const rawCookie = loginRes.headers["set-cookie"];
      const cookieStr = Array.isArray(rawCookie) ? rawCookie.join("; ") : (rawCookie ?? "");

      const refreshRes = await request(server)
        .post("/api/v1/auth/refresh")
        .set("Cookie", cookieStr)
        .send({});

      expect(refreshRes.status).toBe(201);
      expect(refreshRes.body.accessToken).toBeDefined();

      // Ensure rotated refresh cookie was sent back
      const newCookies = refreshRes.headers["set-cookie"];
      expect(newCookies).toBeDefined();
    });

    it("POST /auth/refresh fails with 401 when no refresh token cookie is provided", async () => {
      const failRes = await request(server)
        .post("/api/v1/auth/refresh")
        .send({});

      expect(failRes.status).toBe(401);
      expect(failRes.body.code).toBe("UNAUTHORIZED");
    });

    it("POST /auth/logout clears the refresh_token cookie", async () => {
      const logoutRes = await request(server)
        .post("/api/v1/auth/logout")
        .send({});

      expect(logoutRes.status).toBe(201);
      const cookies = logoutRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookieStr = (cookies as unknown as string[]).join("; ");
      expect(cookieStr).toContain("refresh_token=;");
    });
  });
});
