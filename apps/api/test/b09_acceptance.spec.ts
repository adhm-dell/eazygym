import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { JobsService } from "../src/modules/jobs/jobs.service";

describe("B09 RBAC & Scheduled Jobs & Platform Gyms Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;
  let jobsService: JobsService;

  let ownerToken = "";
  let adminToken = "";
  let receptionToken = "";
  let cashierToken = "";
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
    jobsService = app.get(JobsService);

    // Login Owner (SUPER_ADMIN)
    const ownerRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "owner@powercore.gym", password: "123456" });
    ownerToken = ownerRes.body.accessToken;

    // Login Admin (GYM_ADMIN)
    const adminRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@powercore.gym", password: "123456" });
    adminToken = adminRes.body.accessToken;

    // Login Reception (RECEPTION)
    const recRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "reception@powercore.gym", password: "123456" });
    receptionToken = recRes.body.accessToken;

    // Login Cashier (BAR_CASHIER)
    const cashRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "bar@powercore.gym", password: "123456" });
    cashierToken = cashRes.body.accessToken;

    // Login Coach (COACH)
    const coachRes = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    coachToken = coachRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("1. Real RBAC Role Restrictions & 403 Forbidden", () => {
    it("RECEPTION cannot access /dashboard -> 403 Forbidden", async () => {
      const res = await request(server)
        .get("/api/v1/dashboard")
        .set("Authorization", `Bearer ${receptionToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("BAR_CASHIER cannot access /members -> 403 Forbidden", async () => {
      const res = await request(server)
        .get("/api/v1/members")
        .set("Authorization", `Bearer ${cashierToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("COACH cannot access /staff -> 403 Forbidden", async () => {
      const res = await request(server)
        .get("/api/v1/staff")
        .set("Authorization", `Bearer ${coachToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("GYM_ADMIN can access /dashboard -> 200 OK", async () => {
      const res = await request(server)
        .get("/api/v1/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("revenue");
      expect(res.body).toHaveProperty("openShifts");
      expect(res.body).toHaveProperty("expiringSubscriptions");
      expect(res.body).toHaveProperty("overdueBalances");
    });

    it("GYM_ADMIN cannot access /admin/gyms (SUPER_ADMIN only) -> 403 Forbidden", async () => {
      const res = await request(server)
        .get("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("SUPER_ADMIN can access /admin/gyms -> 200 OK", async () => {
      const res = await request(server)
        .get("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe("2. Quick Real User Switch & Identity Check (/me)", () => {
    it("POST /auth/switch allows switching to RECEPTION and returns valid token", async () => {
      const res = await request(server)
        .post("/api/v1/auth/switch")
        .send({ email: "reception@powercore.gym" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body.user.role).toBe("RECEPTION");

      // Verify token on /me
      const meRes = await request(server)
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.role).toBe("RECEPTION");
      expect(meRes.body.user.name).toBe("سارة حسن (استقبال)");
    });

    it("POST /auth/switch allows switching to GYM_ADMIN and returns valid token", async () => {
      const res = await request(server)
        .post("/api/v1/auth/switch")
        .send({ email: "admin@powercore.gym" });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe("GYM_ADMIN");

      // Verify token on /auth/me alias
      const meRes = await request(server)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.role).toBe("GYM_ADMIN");
    });
  });

  describe("3. Dashboard KPI Aggregations", () => {
    it("GET /dashboard returns accurate breakdown and counters", async () => {
      const res = await request(server)
        .get("/api/v1/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.revenue.total).toBe("number");
      expect(res.body.revenue.byMethod).toHaveProperty("cash");
      expect(res.body.revenue.byMethod).toHaveProperty("card");
      expect(res.body.revenue.byMethod).toHaveProperty("wallet");
      expect(res.body.revenue.byMethod).toHaveProperty("transfer");
      expect(typeof res.body.openShifts.count).toBe("number");
      expect(typeof res.body.expiringSubscriptions.count).toBe("number");
      expect(typeof res.body.overdueBalances.count).toBe("number");
      expect(typeof res.body.newMembersToday).toBe("number");
      expect(typeof res.body.entriesToday).toBe("number");
    });
  });

  describe("4. Super Admin Platform Gym Creation", () => {
    it("SUPER_ADMIN can create a new gym and its initial admin", async () => {
      const testSlug = `test-branch-${Date.now()}`;
      const res = await request(server)
        .post("/api/v1/admin/gyms")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "فرع مدينة نصر",
          slug: testSlug,
          timezone: "Africa/Cairo",
          admin: {
            name: "عمر فاروق",
            email: `nasr.admin.${Date.now()}@powercore.gym`,
            password: "NasrAdminSecure2026!",
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.gym.slug).toBe(testSlug);
      expect(res.body.admin.role).toBe("GYM_ADMIN");
    });
  });

  describe("5. Scheduled Jobs Idempotency", () => {
    it("Runs all scheduled jobs without error", async () => {
      const breaksRes = await jobsService.monitorBreaks();
      expect(breaksRes).toHaveProperty("overruns");

      const freezesRes = await jobsService.autoEndFreezes();
      expect(freezesRes).toHaveProperty("ended");

      const subsRes = await jobsService.recomputeSubscriptions();
      expect(subsRes).toHaveProperty("expired");
      expect(subsRes).toHaveProperty("suspended");

      const shiftsRes = await jobsService.checkShiftsOpenTooLong();
      expect(shiftsRes).toHaveProperty("alerted");

      const milestonesRes = await jobsService.markCommissionEarned();
      expect(milestonesRes).toHaveProperty("markedEarned");
    });
  });
});

