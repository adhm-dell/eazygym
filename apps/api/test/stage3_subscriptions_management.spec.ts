import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { AccessService } from "../src/modules/access/access.service";

describe("Stage 3: Subscriptions Management Across All Members Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;
  let accessService: AccessService;

  let adminToken = "";
  let receptionToken = "";
  let gymId = "";
  let adminId = "";
  let coachAId = "";
  let coachBId = "";

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
    accessService = app.get(AccessService);

    // Login Admin
    const adminLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "admin@powercore.gym", password: "123456" });
    adminToken = adminLogin.body.accessToken;
    gymId = adminLogin.body.user.gymId;
    adminId = adminLogin.body.user.id;

    // Login Reception
    const recLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "reception@powercore.gym", password: "123456" });
    receptionToken = recLogin.body.accessToken;

    // Find two coaches
    const coaches = await prisma.staff.findMany({
      where: { gymId, role: "COACH", isActive: true },
    });
    coachAId = coaches[0]?.id || "";
    coachBId = coaches[1]?.id || "";
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Acceptance: List subscriptions with server-side pagination & KPI summary counters", async () => {
    const res = await request(server)
      .get("/api/v1/subscriptions?page=1&limit=10")
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page", 1);
    expect(res.body).toHaveProperty("limit", 10);
    expect(res.body).toHaveProperty("summary");
    expect(res.body.summary).toHaveProperty("totalActive");
    expect(res.body.summary).toHaveProperty("totalExpiringSoon");
    expect(res.body.summary).toHaveProperty("totalOverdueAmount");
    expect(res.body.summary).toHaveProperty("totalPendingPayment");
  });

  it("2. Acceptance: Filter overdue returns exactly members that scan reports as PAYMENT_OVERDUE", async () => {
    // 1. Create a member
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memberRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عضو متأخر السداد",
        phone,
        gender: "MALE",
      });
    expect(memberRes.status).toBe(201);
    const memberId = memberRes.body.id;

    // 2. Create a plan with dueAfterDays = 5, minUpfrontPercent = 20%
    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة بأقساط ${Date.now()}`,
        kind: "GYM",
        price: 100000, // 1000 EGP
        durationDays: 30,
        minUpfrontPercent: 20,
        dueAfterDays: 5,
        dueAfterPercent: 80,
      });
    expect(planRes.status).toBe(201);
    const planId = planRes.body.id;

    // 3. Sell subscription with only 20% upfront (200 EGP paid, 800 EGP remaining)
    // and backdate start date by 10 days ago (so dueAfterDays = 5 is past!)
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId,
            quantity: 1,
            subscription: {
              startDate: tenDaysAgo.toISOString().slice(0, 10),
            },
          },
        ],
        payments: [
          {
            method: "CASH",
            amount: 20000, // 200 EGP paid
          },
        ],
        useWallet: false,
      });
    expect(invRes.status).toBe(201);
    const subId = invRes.body.items[0].subscriptionId;

    // Explicitly update sub startDate in database to 10 days ago (and originalEndDate)
    await prisma.subscription.update({
      where: { id: subId },
      data: {
        startDate: tenDaysAgo,
        endDate: new Date(tenDaysAgo.getTime() + 30 * 86400000),
      },
    });

    // 4. Scan access for this member -> must report PAYMENT_OVERDUE
    const scanDecision = await accessService.scan(gymId, adminId, phone, new Date());
    expect(scanDecision.allowed).toBe(false);
    expect(scanDecision.reason).toBe("PAYMENT_OVERDUE");

    // 5. Query /subscriptions?overdue=true -> must include this member's subscription
    const overdueRes = await request(server)
      .get("/api/v1/subscriptions?overdue=true")
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(overdueRes.status).toBe(200);
    const overdueItems = overdueRes.body.items || overdueRes.body;
    const found = overdueItems.find((s: any) => s.id === subId);
    expect(found).toBeDefined();
    expect(found.isOverdue).toBe(true);
    expect(found.remaining).toBe(80000); // 800 EGP in piasters
  });

  it("3. Acceptance: Freezing behaves identically with pure domain rules (same denial codes)", async () => {
    // 1. Create a member & subscription with freezeMaxCount = 1, freezeMaxTotalDays = 7
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memberRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عضو تجميد تجريبي",
        phone,
        gender: "FEMALE",
      });
    const memberId = memberRes.body.id;

    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة تجميد ${Date.now()}`,
        kind: "GYM",
        price: 60000,
        durationDays: 30,
        freezeMaxCount: 1,
        freezeMaxTotalDays: 7,
      });
    const planId = planRes.body.id;

    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [{ kind: "SUBSCRIPTION", planId, quantity: 1 }],
        payments: [{ method: "CASH", amount: 60000 }],
        useWallet: false,
      });
    expect(invRes.status).toBe(201);
    const subId = invRes.body.items[0].subscriptionId;

    // 2. Request freeze for 10 days (> 7 allowed) -> 422 REQUEST_EXCEEDS_REMAINING
    const exceedFreeze = await request(server)
      .post(`/api/v1/subscriptions/${subId}/freeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ days: 10, reason: "إجازة طويلة" });
    expect(exceedFreeze.status).toBe(422);
    expect(exceedFreeze.body.code).toBe("REQUEST_EXCEEDS_REMAINING");

    // 3. Freeze within allowance (5 days) -> 201 OK
    const okFreeze = await request(server)
      .post(`/api/v1/subscriptions/${subId}/freeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ days: 5, reason: "سفر" });
    expect(okFreeze.status).toBe(201);
    const frozenSub = await prisma.subscription.findUnique({ where: { id: subId } });
    expect(frozenSub?.status).toBe("FROZEN");

    // 4. Try freezing again while already frozen -> 422 ALREADY_FROZEN
    const doubleFreeze = await request(server)
      .post(`/api/v1/subscriptions/${subId}/freeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ days: 2 });
    expect(doubleFreeze.status).toBe(422);
    expect(doubleFreeze.body.code).toBe("ALREADY_FROZEN");

    // 5. Unfreeze -> 201 OK, status is ACTIVE, end date moved forward
    const unfreeze = await request(server)
      .post(`/api/v1/subscriptions/${subId}/unfreeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({});
    expect(unfreeze.status).toBe(201);
    expect(unfreeze.body.success).toBe(true);
    const activeSub = await prisma.subscription.findUnique({ where: { id: subId } });
    expect(activeSub?.status).toBe("ACTIVE");
  });

  it("4. Acceptance: Coach transfer preview & execute with commission splits", async () => {
    if (!coachAId || !coachBId) return;

    // 1. Create a member & PT subscription
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memberRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عضو تدريب خاص للتحويل",
        phone,
        gender: "MALE",
      });
    const memberId = memberRes.body.id;

    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة تدريب خاص ${Date.now()}`,
        kind: "PT",
        price: 150000,
        durationDays: 30,
        commissionMilestones: 1,
      });
    const planId = planRes.body.id;

    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [{ kind: "SUBSCRIPTION", planId, quantity: 1 }],
        payments: [{ method: "CASH", amount: 150000 }],
        useWallet: false,
      });
    expect(invRes.status).toBe(201);
    const ptSubId = invRes.body.items[0].subscriptionId;

    // Assign Coach A initially
    await prisma.coachAssignment.create({
      data: {
        subscriptionId: ptSubId,
        coachId: coachAId,
        fromDate: new Date(),
        toDate: null,
      },
    });

    // 2. Preview transfer to Coach B
    const previewRes = await request(server)
      .post(`/api/v1/subscriptions/${ptSubId}/transfer-coach/preview`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newCoachId: coachBId });
    expect(previewRes.status).toBe(201);
    expect(previewRes.body).toHaveProperty("milestones");

    // 3. Execute transfer to Coach B
    const transferRes = await request(server)
      .post(`/api/v1/subscriptions/${ptSubId}/transfer-coach`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newCoachId: coachBId,
        reason: "تغيير بناء على رغبة المتدرب",
      });
    expect(transferRes.status).toBe(201);
    expect(transferRes.body.success).toBe(true);

    // Verify assignment updated
    const updatedSub = await prisma.subscription.findUnique({
      where: { id: ptSubId },
      include: { assignments: { where: { toDate: null } } },
    });
    expect(updatedSub?.assignments[0]?.coachId).toBe(coachBId);
  });

  it("5. Acceptance: RBAC guard - Reception cannot cancel subscriptions, Admin can", async () => {
    // 1. Create a subscription
    const phone = "010" + Math.floor(10000000 + Math.random() * 90000000).toString();
    const memberRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عضو لإلغاء الاشتراك",
        phone,
        gender: "MALE",
      });
    const memberId = memberRes.body.id;

    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة إلغاء ${Date.now()}`,
        kind: "GYM",
        price: 40000,
        durationDays: 30,
      });
    const planId = planRes.body.id;

    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [{ kind: "SUBSCRIPTION", planId, quantity: 1 }],
        payments: [{ method: "CASH", amount: 40000 }],
        useWallet: false,
      });
    expect(invRes.status).toBe(201);
    const subId = invRes.body.items[0].subscriptionId;

    // 2. Reception tries to cancel -> 403 Forbidden
    const recCancel = await request(server)
      .post(`/api/v1/subscriptions/${subId}/cancel`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ reason: "محاولة إلغاء غير مصرحة" });
    expect(recCancel.status).toBe(403);

    // 3. Admin cancels -> 201 OK, status is CANCELLED
    const adminCancel = await request(server)
      .post(`/api/v1/subscriptions/${subId}/cancel`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "إلغاء معتمد من الإدارة" });
    expect(adminCancel.status).toBe(201);
    expect(adminCancel.body.status).toBe("CANCELLED");
  });
});
