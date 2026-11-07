import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";

describe("B01 Foundation, Auth & Members Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;

  let adminCairoToken = "";
  let coachAhmedToken = "";
  let adminAlexToken = "";
  let memberToken = "";
  let memberRefreshToken = "";
  let createdMemberId = "";

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Health check: GET /api/v1/health returns 200 ok", async () => {
    const res = await request(server).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("2. Auth Login: Failed credentials returns 401 INVALID_CREDENTIALS", async () => {
    const res = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@powercore.gym", password: "wrong_password" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("3. Auth Login: Valid credentials returns 201 with access token & httpOnly refresh cookie", async () => {
    const res = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@powercore.gym", password: "123456" });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe("GYM_ADMIN");
    adminCairoToken = res.body.accessToken;

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies?.[0]).toContain("refresh_token=");
  });

  it("4. Auth: Member login returns accessToken & member details", async () => {
    const res = await request(server)
      .post("/api/v1/auth/member/login")
      .send({ phone: "01011122233", password: "123456" });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.member.role).toBe("MEMBER");
    expect(res.body.member.code).toBe("100245");
    memberToken = res.body.accessToken;

    const cookieHeader = (res.headers["set-cookie"] as string[] | undefined)?.[0] || "";
    memberRefreshToken = cookieHeader ? cookieHeader.split(";")[0]?.replace("refresh_token=", "") || "" : "";
    expect(memberRefreshToken).toBeTruthy();
  });

  it("5. Auth Refresh: Rotates refresh token and issues new access token", async () => {
    const res = await request(server)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refresh_token=${memberRefreshToken}`);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it("6. Auth Brute Force: 5 failed attempts locks account with 422 ACCOUNT_LOCKED", async () => {
    const bruteForceEmail = "brute.force@powercore.gym";
    for (let i = 0; i < 4; i++) {
      const res = await request(server)
        .post("/api/v1/auth/login")
        .send({ email: bruteForceEmail, password: "wrong_password" });
      expect(res.status).toBe(401);
    }

    const fifthAttempt = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: bruteForceEmail, password: "wrong_password" });

    expect(fifthAttempt.status).toBe(422);
    expect(fifthAttempt.body.code).toBe("ACCOUNT_LOCKED");
  });

  it("7. Cross-tenant isolation: querying member of another gym returns 404 NOT_FOUND", async () => {
    // mem_alex_01 belongs to gym_alex_02. AdminCairo is from gym_cairo_01.
    const res = await request(server)
      .get("/api/v1/members/mem_alex_01")
      .set("Authorization", `Bearer ${adminCairoToken}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("8. Same-tenant access: admin of gym_alex_02 can access their member", async () => {
    const loginAlex = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "alex.admin@powercore.gym", password: "123456" });
    adminAlexToken = loginAlex.body.accessToken;

    const res = await request(server)
      .get("/api/v1/members/mem_alex_01")
      .set("Authorization", `Bearer ${adminAlexToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe("mem_alex_01");
  });

  it("9. Coach authorization: Coach can access assigned trainee, but non-trainee returns 403 FORBIDDEN", async () => {
    const coachLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    coachAhmedToken = coachLogin.body.accessToken;

    // mem_mock_main is assigned to Coach Ahmed -> 200
    const traineeRes = await request(server)
      .get("/api/v1/members/mem_mock_main")
      .set("Authorization", `Bearer ${coachAhmedToken}`);
    expect(traineeRes.status).toBe(200);

    // mem_02 is NOT assigned to Coach Ahmed -> 403
    const nonTraineeRes = await request(server)
      .get("/api/v1/members/mem_02")
      .set("Authorization", `Bearer ${coachAhmedToken}`);
    expect(nonTraineeRes.status).toBe(403);
    expect(nonTraineeRes.body.code).toBe("FORBIDDEN");
  });

  let uniquePhone = "";

  it("10. Members: Create member auto-generates 6-digit code and creates empty wallet", async () => {
    uniquePhone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const res = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminCairoToken}`)
      .send({
        name: "خالد عبد الرحمن",
        phone: uniquePhone,
        gender: "MALE",
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[1-9]\d{5}$/); // 6 digits, no leading zero
    createdMemberId = res.body.id;

    // Check empty wallet created
    const walletRes = await request(server)
      .get(`/api/v1/members/${createdMemberId}/wallet`)
      .set("Authorization", `Bearer ${adminCairoToken}`);

    expect(walletRes.status).toBe(200);
    expect(walletRes.body.balance).toBe(0);
    expect(walletRes.body.transactions).toHaveLength(0);
  });

  it("11. Members: Duplicate phone rejected with 409 PHONE_EXISTS", async () => {
    const res = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminCairoToken}`)
      .send({
        name: "مستخدم مكرر",
        phone: uniquePhone,
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PHONE_EXISTS");
  });

  it("12. Staff: Deactivating the last GYM_ADMIN fails with 422 LAST_ADMIN", async () => {
    const res = await request(server)
      .patch("/api/v1/staff/staff_alex_admin")
      .set("Authorization", `Bearer ${adminAlexToken}`)
      .send({ isActive: false });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("LAST_ADMIN");
  });

  it("13. Members: Block and Unblock member writes audit log", async () => {
    const blockRes = await request(server)
      .post(`/api/v1/members/${createdMemberId}/block`)
      .set("Authorization", `Bearer ${adminCairoToken}`)
      .send({ reason: "إيقاف إداري تجريبي" });

    expect(blockRes.status).toBe(201);
    expect(blockRes.body.isBlocked).toBe(true);

    const unblockRes = await request(server)
      .post(`/api/v1/members/${createdMemberId}/unblock`)
      .set("Authorization", `Bearer ${adminCairoToken}`);

    expect(unblockRes.status).toBe(201);
    expect(unblockRes.body.isBlocked).toBe(false);

    // Verify audit entries
    const auditRes = await request(server)
      .get(`/api/v1/audit?entityType=Member`)
      .set("Authorization", `Bearer ${adminCairoToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.items.length).toBeGreaterThan(0);
  });

  it("14. GET /api/v1/me returns current user profile and gym settings", async () => {
    const res = await request(server)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${adminCairoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("GYM_ADMIN");
    expect(res.body.gym.timezone).toBe("Africa/Cairo");
  });
});

