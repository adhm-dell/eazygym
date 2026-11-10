import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Stage 7: Settings, Staff Accounts, Notifications, Platform Admin Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let superToken = "";
  let adminToken = "";
  let receptionToken = "";
  let gymId = "";
  let coachId = "";
  let coachToken = "";

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

    // 1. Login Super Admin
    const superLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "owner@powercore.gym", password: "123456" });
    superToken = superLogin.body.accessToken;

    // 2. Login Gym Admin
    const adminLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@powercore.gym", password: "123456" });
    adminToken = adminLogin.body.accessToken;
    gymId = adminLogin.body.user.gymId;
    const adminId = adminLogin.body.user.id;

    // Ensure an open shift exists for invoice processing
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

    // 3. Login Reception
    const recLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "reception@powercore.gym", password: "123456" });
    receptionToken = recLogin.body.accessToken;

    // 4. Login Coach
    const coachLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    coachToken = coachLogin.body.accessToken;
    coachId = coachLogin.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("1. Gym Settings & Acceptance Criterion 1", () => {
    it("Admin can fetch settings and update them", async () => {
      const getRes = await request(server)
        .get("/api/v1/gym/settings")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.slug).toBeDefined();
      expect(getRes.body.classEntryMode).toBeDefined();

      const patchRes = await request(server)
        .patch("/api/v1/gym/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          defaultMinUpfrontPercent: 40,
          manualDiscountLimitPercent: 15,
          expiryNotifyDays: [7, 3, 1],
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.defaultMinUpfrontPercent).toBe(40);
      expect(patchRes.body.manualDiscountLimitPercent).toBe(15);
      expect(patchRes.body.expiryNotifyDays).toEqual([7, 3, 1]);
    });

    it("Acceptance 1: Changing classEntryMode to SCHEDULED changes scan result of a class member without started class", async () => {
      const todayDayOfWeek = new Date().getDay();

      // Create schedule for today spanning the whole day
      const schedRes = await request(server)
        .post("/api/v1/class-schedules")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `كلاس اختبار الجدولة مرحلة 7 ${Date.now()}`,
          coachId,
          dayOfWeek: todayDayOfWeek,
          startTime: "00:00",
          endTime: "23:59",
          capacity: 25,
        });
      expect(schedRes.status).toBe(201);
      const scheduleId = schedRes.body.id;

      // Member with class subscription
      const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
      const memRes = await request(server)
        .post("/api/v1/members")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ name: "عضو فحص الحصص مرحلة 7", phone, gender: "MALE" });
      const member = memRes.body;

      const invRes = await request(server)
        .post("/api/v1/invoices")
        .set("Authorization", `Bearer ${adminToken}`)
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
        });

      expect(invRes.status).toBe(201);

      // 1. Ensure mode is RECEPTION_STARTS
      await request(server)
        .patch("/api/v1/gym/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ classEntryMode: "RECEPTION_STARTS" })
        .expect(200);

      // Scan before class start -> CLASS_NOT_STARTED
      const scan1 = await request(server)
        .post("/api/v1/access/scan")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ code: member.code });

      expect(scan1.status).toBe(201);
      expect(scan1.body.allowed).toBe(false);
      expect(scan1.body.reason).toBe("CLASS_NOT_STARTED");

      // 2. Change mode to SCHEDULED
      await request(server)
        .patch("/api/v1/gym/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ classEntryMode: "SCHEDULED", classCheckinEarlyMinutes: 15 })
        .expect(200);

      // Scan same member with advanced timestamp to bypass debounce -> ACTIVE!
      const futureScanTime = new Date(Date.now() + 15000).toISOString();
      const scan2 = await request(server)
        .post("/api/v1/access/scan")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ code: member.code, timestamp: futureScanTime });

      expect(scan2.status).toBe(201);
      expect(scan2.body.allowed).toBe(true);
      expect(scan2.body.reason).toBe("ACTIVE");

      // Reset back to RECEPTION_STARTS
      await request(server)
        .patch("/api/v1/gym/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ classEntryMode: "RECEPTION_STARTS" });
    });

    it("RBAC: Receptionist cannot modify gym settings", async () => {
      const res = await request(server)
        .patch("/api/v1/gym/settings")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({ manualDiscountLimitPercent: 50 });

      expect(res.status).toBe(403);
    });
  });

  describe("2. Staff Accounts & Acceptance Criterion 2", () => {
    it("Admin can list and create staff accounts", async () => {
      const listRes = await request(server)
        .get("/api/v1/staff")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);

      const uniqueEmail = `staff-${Date.now()}@powercore.gym`;
      const createRes = await request(server)
        .post("/api/v1/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "موظف استقبال جديد",
          email: uniqueEmail,
          phone: "01011122233",
          role: "RECEPTION",
          baseSalary: 450000,
          password: "password123",
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBeDefined();
      expect(createRes.body.email).toBe(uniqueEmail);
      expect(createRes.body.role).toBe("RECEPTION");
    });

    it("Acceptance 2: Deactivating the only admin returns LAST_ADMIN", async () => {
      const uniqueSlug = `gym-last-admin-stage7-${Date.now()}`;
      const uniqueEmail = `admin-solo-${Date.now()}@sologym.gym`;

      const createGymRes = await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`)
        .send({
          name: "فرع تجربة سولـو",
          slug: uniqueSlug,
          admin: {
            name: "المدير الوحيد",
            email: uniqueEmail,
            password: "password123",
          },
        });
      expect(createGymRes.status).toBe(201);
      const adminStaffId = createGymRes.body.admin.id;

      // Login as that unique admin
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

    it("RBAC: Receptionist cannot create or modify staff members", async () => {
      const res = await request(server)
        .post("/api/v1/staff")
        .set("Authorization", `Bearer ${receptionToken}`)
        .send({
          name: "محاولة اختراق",
          email: `hack-${Date.now()}@powercore.gym`,
          role: "GYM_ADMIN",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("3. Notifications Center & Acceptance Criterion 3", () => {
    it("Acceptance 3: A new break request produces a live notification for admins", async () => {
      // Ensure coach has an active shift
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

      const breakReason = `استراحة مرحلة 7 ${Date.now()}`;
      const breakRes = await request(server)
        .post("/api/v1/coach-breaks")
        .set("Authorization", `Bearer ${coachToken}`)
        .send({
          coachId,
          reason: breakReason,
        });

      expect(breakRes.status).toBe(201);

      // Check admin notifications
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

      // Mark single notification as read
      const markRes = await request(server)
        .post(`/api/v1/notifications/${breakNotif.id}/read`)
        .set("Authorization", `Bearer ${adminToken}`);
      expect(markRes.status).toBe(201);

      // Mark all notifications as read
      const markAllRes = await request(server)
        .post("/api/v1/notifications/read-all")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(markAllRes.status).toBe(201);
    });
  });

  describe("4. Platform Admin (SUPER_ADMIN only)", () => {
    it("SUPER_ADMIN can list gyms and create a new gym", async () => {
      const listRes = await request(server)
        .get("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.length).toBeGreaterThan(0);

      const uniqueSlug = `gym-platform-${Date.now()}`;
      const createRes = await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`)
        .send({
          name: "فرع المنصة المركزي",
          slug: uniqueSlug,
          timezone: "Africa/Cairo",
          admin: {
            name: "مدير الفرع المنصي",
            email: `admin-platform-${Date.now()}@powercore.gym`,
            password: "password123",
          },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.gym.id).toBeDefined();
      expect(createRes.body.gym.slug).toBe(uniqueSlug);
      expect(createRes.body.admin).toBeDefined();
    });

    it("RBAC: Regular GYM_ADMIN or RECEPTION cannot access /admin/gyms", async () => {
      const adminAccess = await request(server)
        .get("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminAccess.status).toBe(403);

      const receptionAccess = await request(server)
        .get("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${receptionToken}`);
      expect(receptionAccess.status).toBe(403);
    });
  });
});
