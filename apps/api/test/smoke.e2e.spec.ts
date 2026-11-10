import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Smoke Test (E2E Production Trial Flow)", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let superToken = "";
  const uniqueId = Date.now();

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

    // Ensure platform super admin exists
    const superEmail = `super-${uniqueId}@platform.test`;
    const superPassHash = await bcrypt.hash("PlatformSuperAdminPassword123!", 10);
    await prisma.staff.upsert({
      where: { email: superEmail },
      update: {},
      create: {
        gymId: null,
        name: "Platform SuperAdmin",
        email: superEmail,
        passwordHash: superPassHash,
        role: "SUPER_ADMIN",
      },
    });

    const superLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: superEmail, password: "PlatformSuperAdminPassword123!" });
    superToken = superLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("Full Go-Live Lifecycle: Admin logs in -> configures gym -> reception opens shift -> sells first sub with split payment -> triggers rotation -> scan allowed -> closes shift balanced", async () => {
    // 1. Platform creates Gym and Owner Admin
    const gymSlug = `smoke-gym-${uniqueId}`;
    const adminEmail = `owner-${uniqueId}@smokegym.com`;
    const adminPassword = "StrongOwnerPassword2026!";

    const createGymRes = await request(server)
      .post("/api/v1/admin/gyms")
      .set("Authorization", `Bearer ${superToken}`)
      .send({
        name: "جيم باور كور التجريبي",
        slug: gymSlug,
        admin: {
          name: "مالك النادي",
          email: adminEmail,
          password: adminPassword,
        },
      });
    expect(createGymRes.status).toBe(201);
    const gymId = createGymRes.body.gym.id;

    // 2. Admin logs in
    const adminLoginRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: adminEmail, password: adminPassword });
    expect([200, 201]).toContain(adminLoginRes.status);
    const adminToken = adminLoginRes.body.accessToken;
    expect(adminLoginRes.body.user.role).toBe("GYM_ADMIN");

    // 3. Admin creates a Plan
    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "باقة سنوية شاملة",
        kind: "GYM",
        price: 300000, // 3,000 EGP
        durationDays: 365,
        grantsFloorAccess: true,
        freezeMaxCount: 2,
        freezeMaxTotalDays: 30,
      });
    expect(planRes.status).toBe(201);
    const planId = planRes.body.id;

    // 4. Admin creates Receptionist
    const recEmail = `reception-${uniqueId}@smokegym.com`;
    const recPassword = "ReceptionPassword2026!";
    const recStaffRes = await request(server)
      .post("/api/v1/staff")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "موظف الاستقبال الأول",
        email: recEmail,
        role: "RECEPTION",
        baseSalary: 400000,
        password: recPassword,
      });
    expect(recStaffRes.status).toBe(201);

    // 5. Admin creates Coach
    const coachEmail = `coach-${uniqueId}@smokegym.com`;
    const coachPassword = "CoachPassword2026!";
    const coachStaffRes = await request(server)
      .post("/api/v1/staff")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "الكابتن أحمد مدرب",
        email: coachEmail,
        role: "COACH",
        baseSalary: 500000,
        password: coachPassword,
      });
    expect(coachStaffRes.status).toBe(201);
    const coachId = coachStaffRes.body.id;

    // 6. Admin assigns Coach Shift covering now
    const todayDayOfWeek = new Date().getDay();
    await prisma.coachShift.create({
      data: {
        gymId,
        coachId,
        dayOfWeek: todayDayOfWeek,
        startTime: "00:00",
        endTime: "23:59",
        isActive: true,
      },
    });

    // 7. Receptionist logs in
    const recLoginRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: recEmail, password: recPassword });
    expect([200, 201]).toContain(recLoginRes.status);
    const recToken = recLoginRes.body.accessToken;
    expect(recLoginRes.body.user.role).toBe("RECEPTION");

    // 8. Receptionist opens shift with 500.00 EGP (50,000 piasters)
    const openShiftRes = await request(server)
      .post("/api/v1/shifts/open")
      .set("Authorization", `Bearer ${recToken}`)
      .send({ openingCash: 50000 });
    expect(openShiftRes.status).toBe(201);
    const shiftId = openShiftRes.body.id;
    expect(openShiftRes.body.status).toBe("OPEN");
    expect(openShiftRes.body.openingCash).toBe(50000);

    // 9. Receptionist registers a new member
    const memberPhone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const createMemberRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${recToken}`)
      .send({
        name: "محمد كمال",
        phone: memberPhone,
        gender: "MALE",
      });
    expect(createMemberRes.status).toBe(201);
    const member = createMemberRes.body;
    expect(member.id).toBeDefined();
    expect(member.code).toBeDefined();

    // 10. Sell first subscription with split payment: 1,500 Cash + 1,500 Card = 3,000 EGP
    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${recToken}`)
      .send({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId,
            quantity: 1,
          },
        ],
        payments: [
          { method: "CASH", amount: 150000 },
          { method: "CARD", amount: 150000 },
        ],
        useWallet: false,
      });

    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body;
    expect(invoice.total).toBe(300000);
    expect(invoice.collected).toBe(300000);
    expect(invoice.status).toBe("PAID");

    // First subscription must trigger coach rotation
    expect(invoice.rotation).toBeDefined();
    expect(invoice.rotation.status).toBe("PENDING");
    expect(invoice.rotation.coachId).toBe(coachId);

    // 11. Member scans at access gate -> ALLOWED
    const scanRes = await request(server)
      .post("/api/v1/access/scan")
      .set("Authorization", `Bearer ${recToken}`)
      .send({ code: member.code });

    expect(scanRes.status).toBe(201);
    expect(scanRes.body.allowed).toBe(true);
    expect(scanRes.body.reason).toBe("ACTIVE");
    expect(scanRes.body.member.name).toBe("محمد كمال");

    // 12. Check live shift drawer status:
    // expected cash = 50,000 opening + 150,000 cash payment = 200,000 piasters (2,000 EGP)
    const currentShiftRes = await request(server)
      .get("/api/v1/shifts/current")
      .set("Authorization", `Bearer ${recToken}`);
    expect(currentShiftRes.status).toBe(200);
    expect(currentShiftRes.body.expectedCash).toBe(200000);
    expect(currentShiftRes.body.cashPayments).toBe(150000);

    // 13. Close shift with exactly counted cash (200,000 piasters) -> variance: 0
    const closeShiftRes = await request(server)
      .post(`/api/v1/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${recToken}`)
      .send({
        countedCash: 200000,
        note: "إغلاق وردية الاستقبال بنجاح ومطابقة كاملة للدرج",
      });

    expect(closeShiftRes.status).toBe(201);
    expect(closeShiftRes.body.status).toBe("CLOSED");
    expect(closeShiftRes.body.expectedCash).toBe(200000);
    expect(closeShiftRes.body.countedCash).toBe(200000);
    expect(closeShiftRes.body.variance).toBe(0);
  });
});
