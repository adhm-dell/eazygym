import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Stage 1: Coach Rotation & First Subscription Flow Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let adminToken = "";
  let receptionToken = "";
  let coachAToken = "";
  let coachAId = "";
  let coachBToken = "";
  let coachBId = "";
  let coachCToken = "";
  let coachCId = "";
  let coachDId = "";
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

    // Login Coach A (Ahmed)
    const coachALogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    coachAToken = coachALogin.body.accessToken;
    coachAId = coachALogin.body.user.id;

    // Login Coach B (Tarek)
    const coachBLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.tarek@powercore.gym", password: "123456" });
    coachBToken = coachBLogin.body.accessToken;
    coachBId = coachBLogin.body.user.id;

    // Login Coach C (Mona)
    const coachC = await prisma.staff.findFirst({
      where: { email: "coach.mona@powercore.gym" },
    });
    coachCId = coachC!.id;

    const coachCLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.mona@powercore.gym", password: "123456" });
    coachCToken = coachCLogin.body.accessToken;

    // Find or create Coach D (Off-shift coach)
    let coachD = await prisma.staff.findFirst({
      where: { gymId, email: "coach.d@powercore.gym" },
    });
    if (!coachD) {
      coachD = await prisma.staff.create({
        data: {
          gym: { connect: { id: gymId } },
          name: "كابتن دي (خارج الوردية)",
          email: "coach.d@powercore.gym",
          role: "COACH",
          passwordHash: "hashed",
          isActive: true,
        },
      });
    }
    coachDId = coachD.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to setup today's shift for a coach
  const setCoachShift = async (coachId: string, onShift: boolean) => {
    const today = new Date().getDay(); // 0-6
    await prisma.coachShift.deleteMany({ where: { coachId } });
    if (onShift) {
      await prisma.coachShift.create({
        data: {
          gymId,
          coachId,
          dayOfWeek: today,
          startTime: "00:00",
          endTime: "23:59",
          isActive: true,
        },
      });
    }
  };

  // Helper to create a new unique test member
  const createTestMember = async (nameSuffix: string) => {
    const code = `M-${Date.now().toString().slice(-6)}-${nameSuffix}`;
    const res = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: `متدرب تجريبي ${nameSuffix}`,
        phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
        code,
      });
    expect(res.status).toBe(201);
    return res.body;
  };

  beforeEach(async () => {
    // Clean break, assignments, profiles, queues before each test
    await prisma.sessionParticipant.deleteMany();
    await prisma.coachSession.deleteMany();
    await prisma.coachTrainee.deleteMany({
      where: { memberId: { not: "mem_mock_main" } },
    });
    await prisma.fitnessProfileAssignment.deleteMany();
    await prisma.fitnessProfile.deleteMany();
    await prisma.coachBreak.deleteMany();
    await prisma.coachShift.deleteMany();
    await prisma.coachRotationQueue.deleteMany();
    await prisma.notification.deleteMany();

    // Ensure Coaches A, B, C are active; Coach D is active
    await prisma.staff.updateMany({
      where: { id: { in: [coachAId, coachBId, coachCId, coachDId] } },
      data: { isActive: true },
    });
  });

  it("Test 1: First subscription creates 1 profile, 1 PENDING assignment, 1 coach notification, moves coach to back of queue; SECOND subscription creates nothing new", async () => {
    // Put Coach A, B, C on shift
    await setCoachShift(coachAId, true);
    await setCoachShift(coachBId, true);
    await setCoachShift(coachCId, true);

    // Initial queue: A (1), B (2), C (3)
    await prisma.coachRotationQueue.createMany({
      data: [
        { gymId, coachId: coachAId, position: 1 },
        { gymId, coachId: coachBId, position: 2 },
        { gymId, coachId: coachCId, position: 3 },
      ],
    });

    const member = await createTestMember("test1");

    // Sell first subscription via POS invoice
    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_gym_1m",
            quantity: 1,
          },
        ],
        payments: [{ method: "CASH", amount: 150000 }],
      });

    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body;

    // Rotation result in invoice response
    expect(invoice.rotation).toBeDefined();
    expect(invoice.rotation.status).toBe("PENDING");
    expect(invoice.rotation.coachId).toBe(coachAId);
    expect(invoice.rotation.profileId).toBeDefined();

    // Exactly 1 FitnessProfile exists
    const profile = await prisma.fitnessProfile.findUnique({
      where: { memberId: member.id },
      include: { assignments: true },
    });
    expect(profile).toBeTruthy();
    expect(profile!.assignments.length).toBe(1);
    expect(profile!.assignments[0]!.coachId).toBe(coachAId);
    expect(profile!.assignments[0]!.status).toBe("PENDING");

    // Coach notification created
    const notif = await prisma.notification.findFirst({
      where: {
        gymId,
        recipientId: coachAId,
        type: "NEW_MEMBER_ASSIGNMENT",
      },
    });
    expect(notif).toBeTruthy();

    // Coach A moved to back of queue (queue now B: 1, C: 2, A: 3)
    const queue = await prisma.coachRotationQueue.findMany({
      where: { gymId },
      orderBy: { position: "asc" },
    });
    expect(queue.map((q) => q.coachId)).toEqual([coachBId, coachCId, coachAId]);

    // Sell SECOND subscription for the SAME member
    const secondInvoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_gym_1m",
            quantity: 1,
          },
        ],
        payments: [{ method: "CASH", amount: 150000 }],
      });

    expect(secondInvoiceRes.status).toBe(201);
    expect(secondInvoiceRes.body.rotation).toBeUndefined();

    // Database still has only 1 profile and 1 assignment
    const profiles = await prisma.fitnessProfile.findMany({
      where: { memberId: member.id },
      include: { assignments: true },
    });
    expect(profiles.length).toBe(1);
    expect(profiles[0]!.assignments.length).toBe(1);
  });

  it("Test 2: Three coaches on shift (A, B, C), B on break: Sale 1 -> A; A rejects -> C; C accepts -> trainee + free session; queue order is B, A, C", async () => {
    await setCoachShift(coachAId, true);
    await setCoachShift(coachBId, true);
    await setCoachShift(coachCId, true);

    // Initial queue: A (1), B (2), C (3)
    await prisma.coachRotationQueue.createMany({
      data: [
        { gymId, coachId: coachAId, position: 1 },
        { gymId, coachId: coachBId, position: 2 },
        { gymId, coachId: coachCId, position: 3 },
      ],
    });

    // Coach B goes on active break
    await prisma.coachBreak.create({
      data: {
        gymId,
        coachId: coachBId,
        requestedById: coachBId,
        status: "ACTIVE",
        startedAt: new Date(),
      },
    });

    const member = await createTestMember("test2");

    // Sale 1: B is on break, so A (pos 1) gets recommended
    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
        payments: [{ method: "CASH", amount: 150000 }],
      });

    expect(invoiceRes.status).toBe(201);
    expect(invoiceRes.body.rotation.coachId).toBe(coachAId);
    const assignmentAId = invoiceRes.body.rotation.assignmentId;

    // Queue order after A was recommended: B (1), C (2), A (3)
    let q = await prisma.coachRotationQueue.findMany({
      where: { gymId },
      orderBy: { position: "asc" },
    });
    expect(q.map((x) => x.coachId)).toEqual([coachBId, coachCId, coachAId]);

    // Coach A rejects the assignment with reason
    const rejectRes = await request(server)
      .post(`/api/v1/fitness-assignments/${assignmentAId}/reject`)
      .set("Authorization", `Bearer ${coachAToken}`)
      .send({ reason: "الجدول ممتلئ هذا الأسبوع" });

    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.status).toBe("REJECTED");

    // Auto-rotation must have immediately picked C (since B is on break, A already rejected)
    const assignments = await prisma.fitnessProfileAssignment.findMany({
      where: { profileId: invoiceRes.body.rotation.profileId },
      orderBy: { createdAt: "asc" },
    });
    expect(assignments.length).toBe(2);
    expect(assignments[0]!.coachId).toBe(coachAId);
    expect(assignments[0]!.status).toBe("REJECTED");
    expect(assignments[1]!.coachId).toBe(coachCId);
    expect(assignments[1]!.status).toBe("PENDING");

    // Queue order after C took turn: B (1), A (2), C (3)
    q = await prisma.coachRotationQueue.findMany({
      where: { gymId },
      orderBy: { position: "asc" },
    });
    expect(q.map((x) => x.coachId)).toEqual([coachBId, coachAId, coachCId]);

    // Coach C accepts the assignment
    const acceptRes = await request(server)
      .post(`/api/v1/fitness-assignments/${assignments[1]!.id}/accept`)
      .set("Authorization", `Bearer ${coachCToken}`)
      .send({});

    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.status).toBe("ACCEPTED");

    // CoachTrainee created for C + member with 1 free session
    const trainee = await prisma.coachTrainee.findFirst({
      where: { coachId: coachCId, memberId: member.id },
    });
    expect(trainee).toBeTruthy();
    expect(trainee!.freeSessionsGranted).toBe(1);
  });

  it("Test 3: Coach D has lowest position in queue but is OFF shift: never recommended", async () => {
    // Only Coach A and Coach B on shift; Coach D is off shift
    await setCoachShift(coachAId, true);
    await setCoachShift(coachBId, true);
    await setCoachShift(coachDId, false); // No shift today

    // Queue: Coach D has position 0 (the lowest!), A has 1, B has 2
    await prisma.coachRotationQueue.createMany({
      data: [
        { gymId, coachId: coachDId, position: 0 },
        { gymId, coachId: coachAId, position: 1 },
        { gymId, coachId: coachBId, position: 2 },
      ],
    });

    const member = await createTestMember("test3");

    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
        payments: [{ method: "CASH", amount: 150000 }],
      });

    expect(invoiceRes.status).toBe(201);
    // Coach D must NOT be recommended! Coach A is on shift and lowest
    expect(invoiceRes.body.rotation.coachId).toBe(coachAId);
  });

  it("Test 4: Everyone on shift rejected / on break -> NO_ELIGIBLE_COACH; nobody on shift -> NO_COACH_ON_SHIFT", async () => {
    // Case 4a: Coach A is on shift, B is off shift
    await setCoachShift(coachAId, true);
    await setCoachShift(coachBId, false);

    // Initial queue
    await prisma.coachRotationQueue.create({
      data: { gymId, coachId: coachAId, position: 1 },
    });

    const memberA = await createTestMember("test4a");

    // Sale recommended Coach A
    const invA = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: memberA.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
        payments: [{ method: "CASH", amount: 150000 }],
      });
    expect(invA.status).toBe(201);

    // Coach A rejects: since A was the only on-shift coach, nobody is eligible
    await request(server)
      .post(`/api/v1/fitness-assignments/${invA.body.rotation.assignmentId}/reject`)
      .set("Authorization", `Bearer ${coachAToken}`)
      .send({ reason: "خارج المدينة" })
      .expect(201);

    // Notification created with NO_ELIGIBLE_COACH
    const noEligibleNotif = await prisma.notification.findFirst({
      where: {
        gymId,
        recipientType: "ADMIN_BROADCAST",
        body: { contains: "NO_ELIGIBLE_COACH" },
      },
    });
    expect(noEligibleNotif).toBeTruthy();

    // Case 4b: Nobody on shift
    await setCoachShift(coachAId, false);
    await setCoachShift(coachBId, false);
    await setCoachShift(coachCId, false);

    const memberB = await createTestMember("test4b");

    const invB = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: memberB.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
        payments: [{ method: "CASH", amount: 150000 }],
      });

    expect(invB.status).toBe(201);
    expect(invB.body.rotation.status).toBe("NO_COACH_AVAILABLE");

    // Notification created with NO_COACH_ON_SHIFT
    const noShiftNotif = await prisma.notification.findFirst({
      where: {
        gymId,
        recipientType: "ADMIN_BROADCAST",
        body: { contains: "NO_COACH_ON_SHIFT" },
      },
    });
    expect(noShiftNotif).toBeTruthy();
  });

  it("Test 5: Manual assignment supersedes pending one and grants free sessions once", async () => {
    await setCoachShift(coachAId, true);
    await setCoachShift(coachBId, true);

    await prisma.coachRotationQueue.createMany({
      data: [
        { gymId, coachId: coachAId, position: 1 },
        { gymId, coachId: coachBId, position: 2 },
      ],
    });

    const member = await createTestMember("test5");

    const inv = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
        payments: [{ method: "CASH", amount: 150000 }],
      });

    const profileId = inv.body.rotation.profileId;
    const assignmentAId = inv.body.rotation.assignmentId;

    // Manual assign Coach B
    const manualRes = await request(server)
      .post(`/api/v1/fitness-profiles/${profileId}/assign`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ coachId: coachBId });

    expect(manualRes.status).toBe(201);
    expect(manualRes.body.status).toBe("ACCEPTED");

    // Original pending assignment for A is superseded
    const oldAss = await prisma.fitnessProfileAssignment.findUnique({
      where: { id: assignmentAId },
    });
    expect(oldAss!.status).toBe("SUPERSEDED");

    // Trainee for Coach B created with 1 free session
    let traineeB = await prisma.coachTrainee.findFirst({
      where: { coachId: coachBId, memberId: member.id },
    });
    expect(traineeB!.freeSessionsGranted).toBe(1);

    // Call manual assign a second time (e.g. switch to Coach C)
    await request(server)
      .post(`/api/v1/fitness-profiles/${profileId}/assign`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ coachId: coachCId })
      .expect(201);

    // Coach C trainee created, but freeSessionsGranted should be 0 (only granted once per profile)
    const traineeC = await prisma.coachTrainee.findFirst({
      where: { coachId: coachCId, memberId: member.id },
    });
    expect(traineeC!.freeSessionsGranted).toBe(0);
  });

  it("Test 6: Concurrent first-time sales run without deadlocks and preserve queue order", async () => {
    await setCoachShift(coachAId, true);
    await setCoachShift(coachBId, true);
    await setCoachShift(coachCId, true);

    await prisma.coachRotationQueue.createMany({
      data: [
        { gymId, coachId: coachAId, position: 1 },
        { gymId, coachId: coachBId, position: 2 },
        { gymId, coachId: coachCId, position: 3 },
      ],
    });

    const member1 = await createTestMember("conc1");
    const member2 = await createTestMember("conc2");

    // Run two sales concurrently
    const [res1, res2] = await Promise.all([
      request(server)
        .post("/api/v1/invoices")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          memberId: member1.id,
          items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
          payments: [{ method: "CASH", amount: 150000 }],
        }),
      request(server)
        .post("/api/v1/invoices")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          memberId: member2.id,
          items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
          payments: [{ method: "CASH", amount: 150000 }],
        }),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const coachIds = [res1.body.rotation.coachId, res2.body.rotation.coachId];
    // Both sales got coaches, and they received DIFFERENT coaches (A and B)
    expect(coachIds).toContain(coachAId);
    expect(coachIds).toContain(coachBId);
  });
});
