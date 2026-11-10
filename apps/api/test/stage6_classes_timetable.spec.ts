import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Stage 6: Classes Timetable Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let adminToken = "";
  let receptionToken = "";
  let gymId = "";
  let coachId = "";
  let classPlanId = "";

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

    // Find active coach
    const coaches = await prisma.staff.findMany({
      where: { gymId, role: "COACH", isActive: true },
    });
    expect(coaches.length).toBeGreaterThan(0);
    coachId = coaches[0]?.id || "";

    // Find or create CLASS plan
    let classPlan = await prisma.plan.findFirst({
      where: { gymId, kind: "CLASS", isActive: true },
    });
    if (!classPlan) {
      classPlan = await prisma.plan.create({
        data: {
          gymId,
          name: "باقة حصص كروس فيت",
          kind: "CLASS",
          durationDays: 30,
          price: 120000, // 1,200.00 EGP
          grantsFloorAccess: false,
          totalSessions: 12,
          isActive: true,
        },
      });
    }
    classPlanId = classPlan.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const todayDayOfWeek = new Date().getDay();
  let createdScheduleId = "";
  let classMemberId = "";
  let classMemberCode = "";

  it("1. Acceptance: Creating a schedule for a weekday shows it in the grid and list", async () => {
    const res = await request(server)
      .post("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `حصة كروس فيت صباحي ${Date.now()}`,
        coachId,
        dayOfWeek: todayDayOfWeek,
        startTime: "09:00",
        endTime: "10:00",
        capacity: 20,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.dayOfWeek).toBe(todayDayOfWeek);
    expect(res.body.capacity).toBe(20);
    createdScheduleId = res.body.id;

    // Verify it appears in weekly schedule list
    const listRes = await request(server)
      .get("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const found = listRes.body.find((s: any) => s.id === createdScheduleId);
    expect(found).toBeDefined();
    expect(found.registeredCount).toBe(0);

    // Verify it appears in today's classes
    const todayRes = await request(server)
      .get("/api/v1/classes/today")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(todayRes.status).toBe(200);
    const todayFound = todayRes.body.find((s: any) => s.id === createdScheduleId);
    expect(todayFound).toBeDefined();
    expect(todayFound.status).toBe("NOT_STARTED");
  });

  it("2. Acceptance: Shows in the member's class slot picker at sale time and registers member to schedule", async () => {
    // 2a. Create a new member
    const uniqueSuffix = Date.now().toString().slice(-4);
    const memberRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `عضو الحصص ${uniqueSuffix}`,
        phone: `0111${uniqueSuffix}33`,
        gender: "MALE",
      });
    expect(memberRes.status).toBe(201);
    classMemberId = memberRes.body.id;
    classMemberCode = memberRes.body.code;

    // 2b. Sell CLASS plan selecting this schedule slot (classSlotIds: [createdScheduleId])
    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        memberId: classMemberId,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: classPlanId,
            unitPrice: 120000,
            quantity: 1,
            subscription: {
              startDate: new Date().toISOString(),
              classSlotIds: [createdScheduleId],
            },
          },
        ],
        payments: [
          {
            method: "CASH",
            amount: 120000,
          },
        ],
      });
    expect(invoiceRes.status).toBe(201);

    // 2c. Check registered members endpoint for this schedule
    const membersRes = await request(server)
      .get(`/api/v1/class-schedules/${createdScheduleId}/members`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(membersRes.status).toBe(200);
    expect(membersRes.body.length).toBeGreaterThanOrEqual(1);
    const regMember = membersRes.body.find(
      (m: any) => m.member.id === classMemberId
    );
    expect(regMember).toBeDefined();
    expect(regMember.subscriptionStatus).toBe("ACTIVE");
    expect(regMember.member.code).toBe(classMemberCode);

    // 2d. In today's classes, registeredCount is now updated
    const todayRes = await request(server)
      .get("/api/v1/classes/today")
      .set("Authorization", `Bearer ${adminToken}`);
    const todayFound = todayRes.body.find((s: any) => s.id === createdScheduleId);
    expect(todayFound.registeredCount).toBeGreaterThanOrEqual(1);
  });

  it("3. Acceptance: Cancelling today's occurrence makes a registered member's scan return CLASS_CANCELLED", async () => {
    // 3a. Before class start, scan returns CLASS_NOT_STARTED (reception starts mode)
    const scanBeforeRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ code: classMemberCode });
    expect(scanBeforeRes.status).toBe(201);
    expect(scanBeforeRes.body.allowed).toBe(false);
    expect(scanBeforeRes.body.reason).toBe("CLASS_NOT_STARTED");

    // 3b. Cancel today's occurrence via exception
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const exceptionRes = await request(server)
      .post(`/api/v1/class-schedules/${createdScheduleId}/exceptions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        date: todayIsoDate,
        isCancelled: true,
      });
    expect(exceptionRes.status).toBe(201);
    expect(exceptionRes.body.isCancelled).toBe(true);

    // Verify today's class occurrence reflects CANCELLED status
    const todayRes = await request(server)
      .get("/api/v1/classes/today")
      .set("Authorization", `Bearer ${adminToken}`);
    const todayFound = todayRes.body.find((s: any) => s.id === createdScheduleId);
    expect(todayFound.status).toBe("CANCELLED");

    // 3c. Scan member again -> now returns CLASS_CANCELLED!
    // Send with timestamp +15s to bypass scan debounce map
    const scanAfterRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: classMemberCode,
        timestamp: new Date(Date.now() + 15000).toISOString(),
      });
    expect(scanAfterRes.status).toBe(201);
    expect(scanAfterRes.body.allowed).toBe(false);
    expect(scanAfterRes.body.reason).toBe("CLASS_CANCELLED");
  });

  it("4. Acceptance: Normal occurrence Start/End class lifecycle", async () => {
    // 4a. Create a second schedule for today that is not cancelled
    const sched2Res = await request(server)
      .post("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `حصة مسائية ${Date.now()}`,
        coachId,
        dayOfWeek: todayDayOfWeek,
        startTime: "18:00",
        endTime: "19:00",
        capacity: 15,
      });
    const sched2Id = sched2Res.body.id;

    // Enroll a member into this class
    const uniqueSuffix = Date.now().toString().slice(-4);
    const member2Res = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `مشترك الحصة المسائية ${uniqueSuffix}`,
        phone: `0122${uniqueSuffix}44`,
        gender: "FEMALE",
      });
    const member2Code = member2Res.body.code;

    await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        memberId: member2Res.body.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: classPlanId,
            unitPrice: 120000,
            quantity: 1,
            subscription: {
              startDate: new Date().toISOString(),
              classSlotIds: [sched2Id],
            },
          },
        ],
        payments: [{ method: "CASH", amount: 120000 }],
      });

    // 4b. Reception starts the class
    const startRes = await request(server)
      .post(`/api/v1/classes/${sched2Id}/start`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({});
    expect(startRes.status).toBe(201);

    // Today's list shows RUNNING
    const todayRes = await request(server)
      .get("/api/v1/classes/today")
      .set("Authorization", `Bearer ${adminToken}`);
    const sched2Occurrence = todayRes.body.find((s: any) => s.id === sched2Id);
    expect(sched2Occurrence.status).toBe("RUNNING");

    // Member scans -> now allowed: true, status: ACTIVE!
    const scanRunRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: member2Code,
        timestamp: new Date(Date.now() + 15000).toISOString(),
      });
    expect(scanRunRes.status).toBe(201);
    expect(scanRunRes.body.allowed).toBe(true);
    expect(scanRunRes.body.reason).toBe("ACTIVE");

    // 4c. Reception ends the class
    const endRes = await request(server)
      .post(`/api/v1/classes/${sched2Id}/end`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({});
    expect(endRes.status).toBe(201);

    // Today's list shows ENDED
    const todayAfterEnd = await request(server)
      .get("/api/v1/classes/today")
      .set("Authorization", `Bearer ${adminToken}`);
    const sched2Ended = todayAfterEnd.body.find((s: any) => s.id === sched2Id);
    expect(sched2Ended.status).toBe("ENDED");
  });

  it("5. Acceptance: RBAC protection - Reception cannot create/update/add exceptions (403)", async () => {
    // Reception cannot create class schedule
    const recCreate = await request(server)
      .post("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "حصة غير مصرحة",
        coachId,
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "11:00",
        capacity: 10,
      });
    expect(recCreate.status).toBe(403);

    // Reception cannot update class schedule
    const recUpdate = await request(server)
      .patch(`/api/v1/class-schedules/${createdScheduleId}`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "تعديل غير مصرح" });
    expect(recUpdate.status).toBe(403);

    // Reception cannot add exceptions
    const recException = await request(server)
      .post(`/api/v1/class-schedules/${createdScheduleId}/exceptions`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        date: "2026-11-20",
        isCancelled: true,
      });
    expect(recException.status).toBe(403);

    // Reception CAN list schedules
    const recList = await request(server)
      .get("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(recList.status).toBe(200);

    // Reception CAN list registered members
    const recMembers = await request(server)
      .get(`/api/v1/class-schedules/${createdScheduleId}/members`)
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(recMembers.status).toBe(200);
  });
});
