import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { FitnessProfilesService } from "../src/modules/coach-ops/fitness-profiles.service";

describe("B07 Coach Operations Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;
  let adminToken = "";
  let receptionToken = "";
  let coachToken = "";
  let coachId = "";
  let coach2Token = "";
  let coach2Id = "";
  let coach3Id = "";
  let gymId = "";
  let memberId = "";

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

    // Clean up test shifts & breaks & extra test coaches
    await prisma.sessionParticipant.deleteMany();
    await prisma.coachSession.deleteMany();
    await prisma.coachTrainee.deleteMany({
      where: { memberId: { not: "mem_mock_main" } },
    });
    // Ensure seeded coach trainee exists for B01 test
    await prisma.coachTrainee.upsert({
      where: {
        gymId_coachId_memberId: {
          gymId: "gym_cairo_01",
          coachId: "staff_coach",
          memberId: "mem_mock_main",
        },
      },
      create: {
        gymId: "gym_cairo_01",
        coachId: "staff_coach",
        memberId: "mem_mock_main",
        isActive: true,
      },
      update: { isActive: true },
    });
    await prisma.fitnessProfileAssignment.deleteMany();
    await prisma.fitnessProfile.deleteMany();
    await prisma.coachBreak.deleteMany();
    await prisma.coachShift.deleteMany();
    await prisma.coachRotationQueue.deleteMany();

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

    // Login Coach 1 (Ahmed)
    const coachLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    coachToken = coachLogin.body.accessToken;
    coachId = coachLogin.body.user.id;

    // Login Coach 2 (Tarek)
    const coach2Login = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.tarek@powercore.gym", password: "123456" });
    coach2Token = coach2Login.body.accessToken;
    coach2Id = coach2Login.body.user.id;

    // Coach 3 (Mona)
    const coach3 = await prisma.staff.findFirst({
      where: { email: "coach.mona@powercore.gym" },
    });
    coach3Id = coach3!.id;

    // Deactivate any extra coaches so only the 3 test coaches are active
    await prisma.staff.updateMany({
      where: {
        gymId,
        role: "COACH",
        id: { notIn: [coachId, coach2Id, coach3Id] },
      },
      data: { isActive: false },
    });

    // Create a fresh test member
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "عضو اختبار المدربين",
        phone: "010" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        gender: "MALE",
      });
    memberId = memRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("1. Coach working shifts & overnight shift", () => {
    it("should allow admin to create normal and overnight shifts", async () => {
      // Create Friday overnight shift 21:00 -> 05:00 for Coach 1 (dayOfWeek: 5 = Friday)
      const res = await request(server)
        .post("/api/v1/coach-shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          coachId,
          dayOfWeek: 5,
          startTime: "21:00",
          endTime: "05:00",
        });
      expect(res.status).toBe(201);
      expect(res.body.startTime).toBe("21:00");
      expect(res.body.endTime).toBe("05:00");

      // Verify on-shift check at Saturday 02:00 (which is within Friday's overnight shift)
      const testDate = new Date("2026-11-14T02:00:00+02:00").toISOString();
      const onShiftRes = await request(server)
        .get(`/api/v1/coaches/on-shift?at=${testDate}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(onShiftRes.status).toBe(200);
      expect(onShiftRes.body.onShiftCoachIds).toContain(coachId);
    });

    it("should reject overlapping shift for the same coach", async () => {
      const res = await request(server)
        .post("/api/v1/coach-shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          coachId,
          dayOfWeek: 5,
          startTime: "22:00",
          endTime: "04:00",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("OVERLAPPING_SHIFT");
    });
  });

  describe("2. Coach breaks request / approve / reject workflow", () => {
    it("should reject break request if coach is not on shift", async () => {
      // Tuesday at 12:00 when coach has no shift
      const offShiftTime = new Date("2026-11-10T12:00:00+02:00").toISOString();
      const res = await request(server)
        .post(`/api/v1/coach-breaks?now=${offShiftTime}`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          coachId,
          reason: "غداء",
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("NOT_ON_SHIFT");
    });

    it("should allow break request while on shift, setting status PENDING", async () => {
      // Add regular Monday shift 10:00-18:00 for coach 1 (day 1) and coach 2 (day 1)
      await request(server)
        .post("/api/v1/coach-shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ coachId, dayOfWeek: 1, startTime: "10:00", endTime: "18:00" });

      await request(server)
        .post("/api/v1/coach-shifts")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ coachId: coach2Id, dayOfWeek: 1, startTime: "10:00", endTime: "18:00" });

      // Monday at 12:00 Cairo time
      const onShiftTime = new Date("2026-11-09T12:00:00+02:00").toISOString();
      const res = await request(server)
        .post(`/api/v1/coach-breaks?now=${onShiftTime}`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          coachId,
          reason: "غداء سريع",
        });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("PENDING");

      const breakId = res.body.id;

      // Admin approves
      const approveRes = await request(server)
        .post(`/api/v1/coach-breaks/${breakId}/approve?now=${onShiftTime}`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.status).toBe("ACTIVE");
      expect(approveRes.body.startedAt).toBeDefined();

      // Second coach requests break while Coach 1 is ACTIVE -> ANOTHER_COACH_ON_BREAK
      const secondRes = await request(server)
        .post(`/api/v1/coach-breaks?now=${onShiftTime}`)
        .set("Authorization", `Bearer ${coach2Token}`)
        .send({
          coachId: coach2Id,
          reason: "صلاة",
        });
      expect(secondRes.status).toBe(400);
      expect(secondRes.body.message).toContain("ANOTHER_COACH_ON_BREAK");

      // End Coach 1's break
      const endRes = await request(server)
        .post(`/api/v1/coach-breaks/${breakId}/end?now=${onShiftTime}`)
        .set("Authorization", `Bearer ${coachToken}`);
      expect(endRes.status).toBe(201);
      expect(endRes.body.status).toBe("COMPLETED");
    });

    it("should respect max 2 breaks per day (rejected break does NOT count)", async () => {
      const shiftTime = new Date("2026-11-09T14:00:00+02:00").toISOString();

      // Second break request -> Admin rejects it with reason
      const req2 = await request(server)
        .post(`/api/v1/coach-breaks?now=${shiftTime}`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({ coachId, reason: "استراحة 2" });
      expect(req2.status).toBe(201);

      const rejRes = await request(server)
        .post(`/api/v1/coach-breaks/${req2.body.id}/reject`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "ضغط عمل في الجيم" });
      expect(rejRes.status).toBe(201);
      expect(rejRes.body.status).toBe("REJECTED");

      // Third break request: Coach only used 1 non-rejected break, so third request is ALLOWED!
      const req3 = await request(server)
        .post(`/api/v1/coach-breaks?now=${shiftTime}`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({ coachId, reason: "استراحة 3" });
      expect(req3.status).toBe(201);
      expect(req3.body.status).toBe("PENDING");

      // Admin approves and ends it
      await request(server)
        .post(`/api/v1/coach-breaks/${req3.body.id}/approve?now=${shiftTime}`)
        .set("Authorization", `Bearer ${adminToken}`);
      await request(server)
        .post(`/api/v1/coach-breaks/${req3.body.id}/end?now=${shiftTime}`)
        .set("Authorization", `Bearer ${adminToken}`);

      // Fourth request: Now 2 valid breaks have been taken -> DAILY_LIMIT_REACHED
      const req4 = await request(server)
        .post(`/api/v1/coach-breaks?now=${shiftTime}`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({ coachId, reason: "استراحة 4" });
      expect(req4.status).toBe(400);
      expect(req4.body.message).toContain("DAILY_LIMIT_REACHED");
    });
  });

  describe("3. Rotation queue & Fitness profile assignments", () => {
    it("should recommend coaches in order, exclude rejecting coach, and support manual assignment", async () => {
      // Ensure all 3 coaches have active shifts on Monday (day 1) 10:00-18:00
      await prisma.coachShift.createMany({
        data: [
          { gymId, coachId, dayOfWeek: 1, startTime: "10:00", endTime: "18:00", isActive: true },
          { gymId, coachId: coach2Id, dayOfWeek: 1, startTime: "10:00", endTime: "18:00", isActive: true },
          { gymId, coachId: coach3Id, dayOfWeek: 1, startTime: "10:00", endTime: "18:00", isActive: true },
        ],
      });

      // Set rotation queue positions: Coach 1 = 1, Coach 2 = 2, Coach 3 = 3
      await request(server)
        .put("/api/v1/coach-rotation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          queue: [
            { coachId, position: 1 },
            { coachId: coach2Id, position: 2 },
            { coachId: coach3Id, position: 3 },
          ],
        });

      // Put coach 2 on ACTIVE break (via admin, starts at 15:00)
      const shiftTime = new Date("2026-11-09T15:00:00+02:00").toISOString();
      const brk = await request(server)
        .post(`/api/v1/coach-breaks?now=${shiftTime}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ coachId: coach2Id, reason: "راحة" });
      expect(brk.status).toBe(201);
      expect(brk.body.status).toBe("ACTIVE");

      // Create fitness profile for member (trigger rotation)
      const profile = await prisma.fitnessProfile.create({
        data: { gymId, memberId },
      });
      // Trigger rotation for this profile
      const fitService = app.get(FitnessProfilesService);
      await fitService.triggerRotation(gymId, profile.id);

      // Rotation should recommend Coach 1 (since Coach 2 is on break)
      const rotRes = await request(server)
        .get("/api/v1/fitness-assignments?status=PENDING")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(rotRes.status).toBe(200);
      const pendingAssignment = rotRes.body.find((a: any) => a.profileId === profile.id);
      expect(pendingAssignment).toBeDefined();
      expect(pendingAssignment.coachId).toBe(coachId);

      // Coach 1 rejects assignment with reason
      const rejRes = await request(server)
        .post(`/api/v1/fitness-assignments/${pendingAssignment.id}/reject`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({ reason: "الجدول ممتلئ حالياً" });
      expect(rejRes.status).toBe(201);
      expect(rejRes.body.status).toBe("REJECTED");

      // Automatic re-rotation should now pick Coach 3 (Coach 1 rejected, Coach 2 is on break)
      const rot2 = await request(server)
        .get("/api/v1/fitness-assignments?status=PENDING")
        .set("Authorization", `Bearer ${adminToken}`);
      const nextAssignment = rot2.body.find((a: any) => a.profileId === profile.id);
      expect(nextAssignment).toBeDefined();
      expect(nextAssignment.coachId).toBe(coach3Id);

      // Reception assigns Coach 1 manually -> supersedes pending assignment and creates CoachTrainee
      const manualRes = await request(server)
        .post(`/api/v1/fitness-profiles/${profile.id}/assign`)
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ coachId });
      expect(manualRes.status).toBe(201);
      expect(manualRes.body.source).toBe("MANUAL");
      expect(manualRes.body.status).toBe("ACCEPTED");

      // Verify CoachTrainee created with 1 free session
      const trainee = await prisma.coachTrainee.findFirst({
        where: { gymId, coachId, memberId },
      });
      expect(trainee).toBeDefined();
      expect(trainee?.freeSessionsGranted).toBe(1);
      expect(trainee?.freeSessionsUsed).toBe(0);

      // Clean up Coach 2's break
      await request(server)
        .post(`/api/v1/coach-breaks/${brk.body.id}/end?now=${shiftTime}`)
        .set("Authorization", `Bearer ${adminToken}`);
    });
  });

  describe("4. Coach sessions & attendance consumption", () => {
    it("should deduct PT/free sessions only for attended participants and not for no-shows (idempotent)", async () => {
      // 1. Create a PT subscription for member with Coach 1
      const ptPlan = await prisma.plan.findFirst({
        where: { gymId, kind: "PT", isActive: true },
      });

      const ptSub = await prisma.subscription.create({
        data: {
          gymId,
          memberId,
          planId: ptPlan!.id,
          kind: "PT",
          status: "ACTIVE",
          price: 1500,
          minUpfrontPercent: 0,
          createdById: "staff_gym_admin",
          durationDays: 30,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          originalEndDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          totalSessions: 8,
          usedSessions: 0,
          freezeMaxCount: 1,
          freezeMaxTotalDays: 7,
          assignments: {
            create: {
              coachId,
              fromDate: new Date(),
            },
          },
        },
      });

      // Create Member 2 with Free grant
      const mem2 = await prisma.member.create({
        data: {
          gymId,
          code: "M2" + Math.floor(1000 + Math.random() * 9000).toString(),
          name: "عضو ثاني مجاني",
          phone: "011" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        },
      });

      await prisma.coachTrainee.create({
        data: {
          gymId,
          coachId,
          memberId: mem2.id,
          freeSessionsGranted: 2,
          freeSessionsUsed: 0,
        },
      });

      // Create Member 3 (no-show) with PT subscription
      const mem3 = await prisma.member.create({
        data: {
          gymId,
          code: "M3" + Math.floor(1000 + Math.random() * 9000).toString(),
          name: "عضو ثالث غائب",
          phone: "012" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        },
      });

      const ptSub3 = await prisma.subscription.create({
        data: {
          gymId,
          memberId: mem3.id,
          planId: ptPlan!.id,
          kind: "PT",
          status: "ACTIVE",
          price: 1500,
          minUpfrontPercent: 0,
          createdById: "staff_gym_admin",
          durationDays: 30,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          originalEndDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          totalSessions: 8,
          usedSessions: 0,
          freezeMaxCount: 1,
          freezeMaxTotalDays: 7,
          assignments: {
            create: {
              coachId,
              fromDate: new Date(),
            },
          },
        },
      });

      // Create GROUP Coach Session
      const sessRes = await request(server)
        .post("/api/v1/coach-sessions")
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          coachId,
          type: "GROUP",
          startTime: "2026-11-20T10:00:00.000Z",
          endTime: "2026-11-20T11:00:00.000Z",
          capacity: 5,
        });
      expect(sessRes.status).toBe(201);
      const sessionId = sessRes.body.id;

      // Add 3 participants:
      // Participant 1 (PT_LINKED)
      await request(server)
        .post(`/api/v1/coach-sessions/${sessionId}/participants`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          memberId,
          source: "PT_LINKED",
          subscriptionId: ptSub.id,
        });

      // Participant 2 (FREE_GRANT)
      await request(server)
        .post(`/api/v1/coach-sessions/${sessionId}/participants`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          memberId: mem2.id,
          source: "FREE_GRANT",
        });

      // Participant 3 (PT_LINKED - will be no-show)
      await request(server)
        .post(`/api/v1/coach-sessions/${sessionId}/participants`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          memberId: mem3.id,
          source: "PT_LINKED",
          subscriptionId: ptSub3.id,
        });

      // Record attendance: Only Member 1 and Member 2 attended! Member 3 is no-show!
      const attRes = await request(server)
        .post(`/api/v1/coach-sessions/${sessionId}/attendance`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          attendedMemberIds: [memberId, mem2.id],
        });
      expect(attRes.status).toBe(201);
      expect(attRes.body.ptDeductionsCount).toBe(1);
      expect(attRes.body.freeDeductionsCount).toBe(1);

      // Verify DB:
      // Member 1 PT sub usedSessions incremented from 0 to 1
      const updatedSub1 = await prisma.subscription.findUnique({ where: { id: ptSub.id } });
      expect(updatedSub1?.usedSessions).toBe(1);

      // Member 2 CoachTrainee freeSessionsUsed incremented from 0 to 1
      const updatedTrainee2 = await prisma.coachTrainee.findFirst({
        where: { gymId, coachId, memberId: mem2.id },
      });
      expect(updatedTrainee2?.freeSessionsUsed).toBe(1);

      // Member 3 (no-show) PT sub was NOT deducted!
      const updatedSub3 = await prisma.subscription.findUnique({ where: { id: ptSub3.id } });
      expect(updatedSub3?.usedSessions).toBe(0);

      // Idempotency: Calling attendance again with same IDs must not double deduct!
      const attRes2 = await request(server)
        .post(`/api/v1/coach-sessions/${sessionId}/attendance`)
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          attendedMemberIds: [memberId, mem2.id],
        });
      expect(attRes2.status).toBe(201);
      expect(attRes2.body.ptDeductionsCount).toBe(0);
      expect(attRes2.body.freeDeductionsCount).toBe(0);

      const reCheckSub1 = await prisma.subscription.findUnique({ where: { id: ptSub.id } });
      expect(reCheckSub1?.usedSessions).toBe(1);
    });
  });
});
