import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { SetupService } from "../src/modules/setup/setup.service";
import { resetDatabase } from "../../../packages/db/scripts/reset";
import { bootstrap } from "../../../packages/db/prisma/bootstrap";

describe("Stage 10: Backend Clean Start, Reset, Bootstrap, and Setup Checklist", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;
  let authService: AuthService;
  let setupService: SetupService;

  let superToken = "";

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
    authService = app.get(AuthService);
    setupService = app.get(SetupService);

    // Ensure platform super admin exists
    const superEmail = "superadmin@platform.system";
    const superPassHash = await bcrypt.hash("SuperSecurePassword123!", 10);
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
      .send({ email: superEmail, password: "SuperSecurePassword123!" });
    superToken = superLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("1. Password Security Hardening", () => {
    it("verifyPassword strictly checks bcrypt and fails closed on non-bcrypt or plain text hashes", async () => {
      // 1. Plain text comparison must return false
      const isPlainValid = await authService.verifyPassword("secret12345", "secret12345");
      expect(isPlainValid).toBe(false);

      // 2. Non-bcrypt / invalid format hash must return false
      const isInvalidValid = await authService.verifyPassword("secret12345", "md5_hash_sample_value");
      expect(isInvalidValid).toBe(false);

      // 3. Null or undefined hash must return false
      const isNullValid = await authService.verifyPassword("secret12345", null);
      expect(isNullValid).toBe(false);

      // 4. Legitimate bcrypt hash must succeed
      const validHash = await bcrypt.hash("secret12345", 10);
      const isBcryptValid = await authService.verifyPassword("secret12345", validHash);
      expect(isBcryptValid).toBe(true);

      // 5. Wrong password against legitimate bcrypt hash must fail
      const isWrongBcryptValid = await authService.verifyPassword("wrongpass", validHash);
      expect(isWrongBcryptValid).toBe(false);
    });

    it("createGym rejects weak or short admin passwords (< 10 chars or common dictionary)", async () => {
      const slug = `gym-sec-${Date.now()}`;

      // Short password (< 10)
      const shortRes = await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`)
        .send({
          name: "فرع أمان 1",
          slug: `${slug}-1`,
          admin: {
            name: "المدير",
            email: `admin-${Date.now()}-1@gymsec.gym`,
            password: "short",
          },
        });
      expect(shortRes.status).toBe(400);
      expect(shortRes.body.code).toBe("INVALID_PASSWORD");

      // Common weak password
      const weakRes = await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`)
        .send({
          name: "فرع أمان 2",
          slug: `${slug}-2`,
          admin: {
            name: "المدير",
            email: `admin-${Date.now()}-2@gymsec.gym`,
            password: "password",
          },
        });
      expect(weakRes.status).toBe(400);
      expect(weakRes.body.code).toBe("INVALID_PASSWORD");

      // Valid strong password (>= 10 chars)
      const validRes = await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`)
        .send({
          name: "فرع أمان 3",
          slug: `${slug}-3`,
          admin: {
            name: "المدير",
            email: `admin-${Date.now()}-3@gymsec.gym`,
            password: "StrongAdminPassword2026!",
          },
        });
      expect(validRes.status).toBe(201);
      expect(validRes.body.admin.email).toBeDefined();
    });

    it("createStaff rejects missing, short, or weak passwords", async () => {
      // Create a gym to test staff creation
      const slug = `gym-staff-sec-${Date.now()}`;
      const adminEmail = `admin-${Date.now()}@staffgym.gym`;
      const adminPass = "StrongAdminPassword2026!";

      await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`)
        .send({
          name: "فرع أمان الموظفين",
          slug,
          admin: { name: "المدير", email: adminEmail, password: adminPass },
        });

      const adminLogin = await request(server)
        .post("/api/v1/auth/login")
        .send({ email: adminEmail, password: adminPass });
      const adminToken = adminLogin.body.accessToken;

      // Short password (< 10)
      const shortRes = await request(server)
        .post("/api/v1/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "موظف تجربة",
          email: `emp-${Date.now()}-1@test.com`,
          role: "RECEPTION",
          password: "short",
        });
      expect(shortRes.status).toBe(400);

      // Weak password
      const weakRes = await request(server)
        .post("/api/v1/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "موظف تجربة 2",
          email: `emp-${Date.now()}-2@test.com`,
          role: "RECEPTION",
          password: "password",
        });
      expect(weakRes.status).toBe(400);

      // Valid password (>= 10)
      const validRes = await request(server)
        .post("/api/v1/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "موظف تجربة 3",
          email: `emp-${Date.now()}-3@test.com`,
          role: "RECEPTION",
          password: "StaffSecurePassword123!",
        });
      expect(validRes.status).toBe(201);
      expect(validRes.body.id).toBeDefined();
    });
  });

  describe("2. Setup Status Checklist (GET /api/v1/setup/status)", () => {
    it("reports incomplete on a new gym, and complete once all required items are configured", async () => {
      // 1. Create a fresh clean gym
      const slug = `clean-gym-${Date.now()}`;
      const adminEmail = `admin-${Date.now()}@cleangym.com`;
      const adminPass = "CleanGymAdminPassword123!";

      const createRes = await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${superToken}`)
        .send({
          name: "جيم نظيف للاختبار",
          slug,
          admin: { name: "المالك", email: adminEmail, password: adminPass },
        });
      const gymId = createRes.body.gym.id;

      const adminLogin = await request(server)
        .post("/api/v1/auth/login")
        .send({ email: adminEmail, password: adminPass });
      const adminToken = adminLogin.body.accessToken;

      // 2. Initial setup status: isComplete should be false
      const initialStatusRes = await request(server)
        .get("/api/v1/setup/status")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(initialStatusRes.status).toBe(200);
      const initial = initialStatusRes.body;

      expect(initial.isComplete).toBe(false);
      expect(initial.plans).toBe(false);
      expect(initial.reception).toBe(false);
      expect(initial.coaches).toBe(false);
      expect(initial.coachShifts).toBe(false);
      expect(initial.commissionTiers).toBe(false);
      expect(initial.paymentPolicy).toBe(true); // default settings are non-null
      expect(initial.completedSteps).toBe(1);
      expect(initial.totalRequiredSteps).toBe(6);

      // 3. Add a Plan
      await request(server)
        .post("/api/v1/plans")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "باقة سنوية",
          kind: "GYM",
          price: 300000,
          durationDays: 365,
          grantsFloorAccess: true,
        });

      // 4. Add Reception
      await request(server)
        .post("/api/v1/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "موظف استقبال",
          email: `rec-${Date.now()}@cleangym.com`,
          role: "RECEPTION",
          password: "ReceptionPassword123!",
        });

      // 5. Add Coach
      const coachRes = await request(server)
        .post("/api/v1/staff")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "كابتن مدرب",
          email: `coach-${Date.now()}@cleangym.com`,
          role: "COACH",
          password: "CoachPassword123!",
        });
      const coachId = coachRes.body.id;

      // Check status: coach exists but no shift yet -> coachShifts is false
      const midStatus = await request(server)
        .get("/api/v1/setup/status")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(midStatus.body.coaches).toBe(true);
      expect(midStatus.body.coachShifts).toBe(false);

      // 6. Add Coach Shift
      await prisma.coachShift.create({
        data: {
          gymId,
          coachId,
          dayOfWeek: 0,
          startTime: "08:00",
          endTime: "16:00",
          isActive: true,
        },
      });

      // 7. Add Commission Tiers starting at 0
      await prisma.commissionTier.create({
        data: {
          gymId,
          coachId: null,
          minRevenue: 0,
          percent: 50,
        },
      });

      // 8. Final setup status: all 6 required items are ready -> isComplete is true!
      const finalStatusRes = await request(server)
        .get("/api/v1/setup/status")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(finalStatusRes.status).toBe(200);
      const finalStatus = finalStatusRes.body;

      expect(finalStatus.isComplete).toBe(true);
      expect(finalStatus.plans).toBe(true);
      expect(finalStatus.reception).toBe(true);
      expect(finalStatus.coaches).toBe(true);
      expect(finalStatus.coachShifts).toBe(true);
      expect(finalStatus.commissionTiers).toBe(true);
      expect(finalStatus.paymentPolicy).toBe(true);
      expect(finalStatus.completedSteps).toBe(6);
    });
  });

  describe("3. Database Bootstrap and Reset Safety", () => {
    it("resetDatabase refuses to run without ALLOW_DB_RESET=true", async () => {
      const prevVal = process.env.ALLOW_DB_RESET;
      process.env.ALLOW_DB_RESET = "false";
      try {
        await expect(resetDatabase({ confirm: "any_db" })).rejects.toThrow(
          "Set ALLOW_DB_RESET=true to allow a reset"
        );
      } finally {
        process.env.ALLOW_DB_RESET = prevVal;
      }
    });

    it("resetDatabase refuses to run with incorrect --confirm name", async () => {
      const prevVal = process.env.ALLOW_DB_RESET;
      process.env.ALLOW_DB_RESET = "true";
      try {
        await expect(resetDatabase({ confirm: "wrong_db_name" })).rejects.toThrow(
          "Pass --confirm="
        );
      } finally {
        process.env.ALLOW_DB_RESET = prevVal;
      }
    });

    it("bootstrap is idempotent and can safely be run twice", async () => {
      const slug = `boot-${Date.now()}`;
      process.env.BOOTSTRAP_GYM_NAME = "جيم التجربة الابتدائية";
      process.env.BOOTSTRAP_GYM_SLUG = slug;
      process.env.BOOTSTRAP_ADMIN_NAME = "مالك الجيم التجريبي";
      process.env.BOOTSTRAP_ADMIN_EMAIL = `owner-${Date.now()}@bootstrap.test`;
      process.env.BOOTSTRAP_ADMIN_PASSWORD = "StrongBootstrapPassword123!";

      const run1 = await bootstrap(prisma as any);
      expect(run1.slug).toBe(slug);

      const run2 = await bootstrap(prisma as any);
      expect(run2.slug).toBe(slug);

      const count = await prisma.gym.count({ where: { slug } });
      expect(count).toBe(1);
    });
  });
});
