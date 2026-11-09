import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("B05 Access, Classes & Visitors Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;
  let adminToken = "";
  let receptionToken = "";

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

    // Login Reception
    const recLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "reception@powercore.gym", password: "123456" });
    receptionToken = recLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Access Scan: Blocked member returns BLOCKED with allowed=false", async () => {
    const res = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: "100303" }); // mem_03 is blocked in seed

    expect(res.status).toBe(201);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toBe("BLOCKED");
    expect(res.body.member.isBlocked).toBe(true);
  });

  it("2. Access Scan: Member with no subscriptions returns NO_SUBSCRIPTION with action SELL", async () => {
    // Create new member with no subscriptions
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "عضو بدون اشتراك", phone, gender: "MALE" });

    const member = memRes.body;

    const scanRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.allowed).toBe(false);
    expect(scanRes.body.reason).toBe("NO_SUBSCRIPTION");
    expect(scanRes.body.nextAction).toBe("SELL");
  });

  it("3. Access Scan: Active subscription returns ACTIVE with allowed=true", async () => {
    // Sell 1-month Gym plan to a new member, fully paid
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "عضو نشط للجيم", phone, gender: "FEMALE" });
    const member = memRes.body;

    await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gym_1m", quantity: 1 }],
        payments: [{ method: "CASH", amount: 90000 }],
        useWallet: false,
      })
      .expect(201);

    const scanRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.allowed).toBe(true);
    expect(scanRes.body.reason).toBe("ACTIVE");
    expect(scanRes.body.subscription.kind).toBe("GYM");

    // Test 10s debounce
    const repeatScan = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(repeatScan.status).toBe(201);
    expect(repeatScan.body.duplicate).toBe(true);
  });

  it("4. Access Scan: Frozen subscription returns FROZEN with action UNFREEZE", async () => {
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "عضو مجمد", phone, gender: "MALE" });
    const member = memRes.body;

    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gold_01", quantity: 1 }],
        payments: [{ method: "CASH", amount: 200000 }],
        useWallet: false,
      });

    const subId = invRes.body.items[0].subscriptionId;

    // Freeze subscription
    await request(server)
      .post(`/api/v1/subscriptions/${subId}/freeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ days: 7, reason: "سفر أسبوع" })
      .expect(201);

    // Scan
    const scanRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.allowed).toBe(false);
    expect(scanRes.body.reason).toBe("FROZEN");
    expect(scanRes.body.nextAction).toBe("UNFREEZE");
  });

  it("5. Classes Lifecycle: Schedule class today -> member scan before start is CLASS_NOT_STARTED -> reception starts -> member scan is ACTIVE", async () => {
    // Current day of week (0 = Sunday .. 6 = Saturday)
    const todayDayOfWeek = new Date().getDay();

    // 1. Create Class Schedule for today
    const schedRes = await request(server)
      .post("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `كلاس كروس فيت ${Date.now()}`,
        coachId: "staff_coach",
        dayOfWeek: todayDayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        capacity: 25,
      });
    expect(schedRes.status).toBe(201);
    const scheduleId = schedRes.body.id;

    // 2. Member with CLASS subscription registered in this slot
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "مشترك كلاس", phone, gender: "FEMALE" });
    const member = memRes.body;

    await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_crossfit_1m",
            quantity: 1,
            subscription: {
              classSlotIds: [scheduleId],
            },
          },
        ],
        payments: [{ method: "CASH", amount: 120000 }],
        useWallet: false,
      })
      .expect(201);

    // 3. Scan member before start -> CLASS_NOT_STARTED with action START_CLASS
    const preScan = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(preScan.status).toBe(201);
    expect(preScan.body.allowed).toBe(false);
    expect(preScan.body.reason).toBe("CLASS_NOT_STARTED");
    expect(preScan.body.nextAction).toBe("START_CLASS");

    // 4. Reception starts class
    const startRes = await request(server)
      .post(`/api/v1/classes/${scheduleId}/start`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ note: "بدأت الحصة بحضور الكابتن" });

    expect(startRes.status).toBe(201);
    expect(startRes.body.startedAt).toBeTruthy();

    // 5. Scan same member with a slightly advanced timestamp to bypass 10s debounce -> ACTIVE
    const futureScanTime = new Date(Date.now() + 15000).toISOString();
    const postScan = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code, timestamp: futureScanTime });

    expect(postScan.status).toBe(201);
    expect(postScan.body.allowed).toBe(true);
    expect(postScan.body.reason).toBe("ACTIVE");

    // 6. End class
    const endRes = await request(server)
      .post(`/api/v1/classes/${scheduleId}/end`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send();

    expect(endRes.status).toBe(201);
    expect(endRes.body.endedAt).toBeTruthy();
  });

  it("6. Visitors: Create visitor and check-in using member's invitation quota", async () => {
    // 1. Create visitor
    const visitorPhone = "011" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const visRes = await request(server)
      .post("/api/v1/visitors")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "خالد الزائر",
        phone: visitorPhone,
        notes: "ضيف تجربة ليوم واحد",
      });

    expect(visRes.status).toBe(201);
    const visitorId = visRes.body.id;

    // 2. Duplicate phone throws 409
    const dupRes = await request(server)
      .post("/api/v1/visitors")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "خالد الزائر مكرر",
        phone: visitorPhone,
      });

    expect(dupRes.status).toBe(409);

    // 3. Member with invitations quota (Gold plan has 2 invitations)
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "عضو جولد يدعو ضيوف", phone, gender: "MALE" });
    const member = memRes.body;

    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gold_01", quantity: 1 }],
        payments: [{ method: "CASH", amount: 200000 }],
        useWallet: false,
      });
    const subId = invRes.body.items[0].subscriptionId;

    // Check-in visitor 1st time -> OK
    const checkin1 = await request(server)
      .post("/api/v1/visitors/check-in")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        visitorId,
        invitedByMemberId: member.id,
        subscriptionId: subId,
      });

    expect(checkin1.status).toBe(201);
    expect(checkin1.body.visitorId).toBe(visitorId);

    // Check-in visitor 2nd time -> OK (used 2 of 2)
    const checkin2 = await request(server)
      .post("/api/v1/visitors/check-in")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        visitorId,
        invitedByMemberId: member.id,
        subscriptionId: subId,
      });

    expect(checkin2.status).toBe(201);

    // Check-in visitor 3rd time -> 422 NO_INVITATIONS_LEFT
    const checkin3 = await request(server)
      .post("/api/v1/visitors/check-in")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        visitorId,
        invitedByMemberId: member.id,
        subscriptionId: subId,
      });

    expect(checkin3.status).toBe(422);
    expect(checkin3.body.code).toBe("NO_INVITATIONS_LEFT");

    // Check visitor profile shows attendances
    const profileRes = await request(server)
      .get(`/api/v1/visitors/${visitorId}`)
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.attendances.length).toBe(2);
  });

  it("7. Classes Exception: Cancelling today's occurrence returns CLASS_CANCELLED on scan & GET members", async () => {
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const todayDateStr = today.toISOString().slice(0, 10);

    // 1. Create Class Schedule for today
    const schedRes = await request(server)
      .post("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `كلاس استثناء ${Date.now()}`,
        coachId: "staff_coach",
        dayOfWeek: todayDayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        capacity: 20,
      });
    expect(schedRes.status).toBe(201);
    const scheduleId = schedRes.body.id;

    // 2. Member with CLASS subscription registered in this slot
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "مشترك كلاس ملغي", phone, gender: "MALE" });
    const member = memRes.body;

    await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_crossfit_1m",
            quantity: 1,
            subscription: {
              classSlotIds: [scheduleId],
            },
          },
        ],
        payments: [{ method: "CASH", amount: 120000 }],
        useWallet: false,
      })
      .expect(201);

    // 3. Verify member appears in GET /class-schedules/:id/members
    const membersRes = await request(server)
      .get(`/api/v1/class-schedules/${scheduleId}/members`)
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(membersRes.status).toBe(200);
    expect(Array.isArray(membersRes.body)).toBe(true);
    expect(membersRes.body.length).toBe(1);
    expect(membersRes.body[0].member.id).toBe(member.id);

    // 4. Create Exception: Cancel today's occurrence
    const exRes = await request(server)
      .post(`/api/v1/class-schedules/${scheduleId}/exceptions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        date: todayDateStr,
        isCancelled: true,
      });

    expect(exRes.status).toBe(201);
    expect(exRes.body.isCancelled).toBe(true);

    // 5. Scan member -> returns CLASS_CANCELLED
    const scanRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.allowed).toBe(false);
    expect(scanRes.body.reason).toBe("CLASS_CANCELLED");
  });

  it("8. Subscriptions Management: Filtering overdue returns exactly scan PAYMENT_OVERDUE member, and freeze checks", async () => {
    // 1. Create a plan with minUpfrontPercent=50, dueAfterDays=0 (due immediately after upfront)
    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة تقسيط فورية ${Date.now()}`,
        kind: "GYM",
        price: 100000,
        durationDays: 30,
        grantsFloorAccess: true,
        minUpfrontPercent: 50,
        dueAfterDays: 0,
        freezeMaxCount: 2,
        freezeMaxTotalDays: 15,
      });
    expect(planRes.status).toBe(201);
    const plan = planRes.body;

    // 2. Member buys with partial payment (50% upfront = 50,000 piasters)
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "عضو متأخر السداد", phone, gender: "MALE" });
    const member = memRes.body;

    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [{ kind: "SUBSCRIPTION", planId: plan.id, quantity: 1 }],
        payments: [{ method: "CASH", amount: 50000 }],
        useWallet: false,
      })
      .expect(201);

    const subId = invRes.body.items[0].subscriptionId;

    // 3. Scan member at the gate -> must return PAYMENT_OVERDUE!
    const scanRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.allowed).toBe(false);
    expect(scanRes.body.reason).toBe("PAYMENT_OVERDUE");

    // 4. Central Subscriptions screen GET /subscriptions?overdue=true
    const overdueListRes = await request(server)
      .get("/api/v1/subscriptions?overdue=true&page=1&limit=50")
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(overdueListRes.status).toBe(200);
    expect(overdueListRes.body.items).toBeDefined();
    const found = overdueListRes.body.items.find((s: any) => s.id === subId);
    expect(found).toBeDefined();
    expect(found.member.id).toBe(member.id);
    expect(found.isOverdue).toBe(true);
    expect(found.remaining).toBe(50000);

    // 5. Freezing this overdue subscription must be denied with PAYMENT_OVERDUE
    const freezeRes = await request(server)
      .post(`/api/v1/subscriptions/${subId}/freeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ days: 7, reason: "محاولة تجميد اشتراك متأخر" });

    expect(freezeRes.status).toBe(422);
    expect(freezeRes.body.code).toBe("PAYMENT_OVERDUE");
  });

  it("9. Phase 06f: Changing classEntryMode to SCHEDULED allows access without started class", async () => {
    const today = new Date();
    const todayDayOfWeek = today.getDay();

    // 1. Create schedule for today spanning the whole day
    const schedRes = await request(server)
      .post("/api/v1/class-schedules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `كلاس وضع الجدولة ${Date.now()}`,
        coachId: "staff_coach",
        dayOfWeek: todayDayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        capacity: 20,
      });
    expect(schedRes.status).toBe(201);
    const scheduleId = schedRes.body.id;

    // 2. Member with class subscription
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "عضو فحص الجدولة", phone, gender: "FEMALE" });
    const member = memRes.body;

    await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_crossfit_1m",
            quantity: 1,
            subscription: {
              classSlotIds: [scheduleId],
            },
          },
        ],
        payments: [{ method: "CASH", amount: 120000 }],
        useWallet: false,
      })
      .expect(201);

    // 3. Ensure mode is RECEPTION_STARTS
    await request(server)
      .patch("/api/v1/gym/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ classEntryMode: "RECEPTION_STARTS" })
      .expect(200);

    // 4. Scan before class start -> CLASS_NOT_STARTED
    const scan1 = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code });

    expect(scan1.status).toBe(201);
    expect(scan1.body.allowed).toBe(false);
    expect(scan1.body.reason).toBe("CLASS_NOT_STARTED");

    // 5. Change mode to SCHEDULED
    await request(server)
      .patch("/api/v1/gym/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ classEntryMode: "SCHEDULED", classCheckinEarlyMinutes: 15 })
      .expect(200);

    // 6. Scan same member with advanced timestamp to bypass debounce -> ACTIVE!
    const futureScanTime = new Date(Date.now() + 15000).toISOString();
    const scan2 = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ code: member.code, timestamp: futureScanTime });

    expect(scan2.status).toBe(201);
    expect(scan2.body.allowed).toBe(true);
    expect(scan2.body.reason).toBe("ACTIVE");

    // Reset back
    await request(server)
      .patch("/api/v1/gym/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ classEntryMode: "RECEPTION_STARTS" });
  });

  it("10. Phase 06f: Deactivating the only admin returns LAST_ADMIN", async () => {
    // 1. SuperAdmin creates a new gym with its first admin
    const superLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "owner@powercore.gym", password: "123456" });
    const superToken = superLogin.body.accessToken;

    const uniqueSlug = `gym-last-admin-${Date.now()}`;
    const uniqueEmail = `admin-${Date.now()}@testgym.gym`;

    const createGymRes = await request(server)
      .post("/api/v1/admin/gyms")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        name: "فرع تجربة لاست أدمن",
        slug: uniqueSlug,
        admin: {
          name: "مدير وحيد",
          email: uniqueEmail,
          password: "password123",
        },
      });
    expect(createGymRes.status).toBe(201);
    const adminStaffId = createGymRes.body.admin.id;

    // Login as that admin
    const adminLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: uniqueEmail, password: "password123" });
    const localAdminToken = adminLogin.body.accessToken;

    // Attempt to deactivate that admin -> 422 LAST_ADMIN
    const deactRes = await request(server)
      .patch(`/api/v1/staff/${adminStaffId}`)
      .set("Authorization", `Bearer ${localAdminToken}`)
      .send({ isActive: false });

    expect(deactRes.status).toBe(422);
    expect(deactRes.body.code).toBe("LAST_ADMIN");
  });

  it("11. Phase 06f: A new break request produces a live notification for admins", async () => {
    // 1. Login coach
    const coachLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    const coachToken = coachLogin.body.accessToken;
    const coachId = coachLogin.body.user.id;
    const gymId = coachLogin.body.user.gymId;

    // 2. Ensure coach has an active shift and clean break state
    await prisma.coachBreak.deleteMany({ where: { gymId } });
    await prisma.coachShift.deleteMany({ where: { coachId } });
    for (let day = 0; day < 7; day++) {
      await prisma.coachShift.create({
        data: {
          gymId,
          coachId,
          dayOfWeek: day,
          startTime: "00:00",
          endTime: "23:59",
          isActive: true,
        },
      });
    }

    // 3. Coach requests a break
    const breakReason = `استراحة صلاة وغداء ${Date.now()}`;
    const breakRes = await request(server)
      .post("/api/v1/coach-breaks")
      .set("Authorization", `Bearer ${coachToken}`)
      .send({
        coachId,
        reason: breakReason,
      });

    expect(breakRes.status).toBe(201);

    // 4. Admin checks notifications -> received BREAK_REQUESTED
    const notifsRes = await request(server)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(notifsRes.status).toBe(200);
    expect(notifsRes.body.items).toBeDefined();
    const breakNotif = notifsRes.body.items.find(
      (n: any) => n.type === "BREAK_REQUESTED" && n.body.includes(breakReason)
    );
    expect(breakNotif).toBeDefined();
    expect(breakNotif.title).toBe("طلب استراحة مدرب");
  });
});
