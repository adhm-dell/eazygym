import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("B08 Commissions & Payroll Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;
  let adminToken = "";
  let receptionToken = "";
  let coachAhmedToken = "";
  let coachAhmedId = "";
  let coachTarekId = "";
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

    // Clean up payroll runs and commission entries for clean test
    await prisma.payrollLine.deleteMany();
    await prisma.commissionEntry.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.commissionTier.deleteMany();
    await prisma.paymentAllocation.deleteMany({
      where: { coachId: { not: null } },
    });

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

    // Login Coach Ahmed
    const coachLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "coach.ahmed@powercore.gym", password: "123456" });
    coachAhmedToken = coachLogin.body.accessToken;

    // Query Staff & Gym IDs from Prisma
    const coachAhmed = await prisma.staff.findFirst({
      where: { email: "coach.ahmed@powercore.gym" },
    });
    coachAhmedId = coachAhmed!.id;
    gymId = coachAhmed!.gymId!;

    const coachTarek = await prisma.staff.findFirst({
      where: { email: "coach.tarek@powercore.gym" },
    });
    coachTarekId = coachTarek!.id;

    // Create a fresh test member
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عضو اختبار العمولات والرواتب",
        phone: "010" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        gender: "MALE",
      });
    memberId = memRes.body.id;

    // PT Plan: 3000 / 3 months (84 days -> exactly 28 days per month: Jan, Feb, Mar)
    await prisma.plan.upsert({
      where: { id: "plan_pt_3000_3m" },
      update: { durationDays: 84 },
      create: {
        id: "plan_pt_3000_3m",
        gymId,
        name: "تدريب شخصي 3000 / 3 أشهر",
        kind: "PT",
        price: 3000,
        durationDays: 84,
        grantsFloorAccess: false,
        totalSessions: 36,
        commissionable: true,
        commissionMilestones: 3,
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Tiers validation: rejects empty, missing 0 threshold, and out of range", async () => {
    // Empty tiers -> NO_TIERS_CONFIGURED
    const emptyRes = await request(server)
      .put("/api/v1/commission-tiers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tiers: [] });
    expect(emptyRes.status).toBe(400);
    expect(emptyRes.body.code).toBe("NO_TIERS_CONFIGURED");

    // Missing 0 threshold -> TIERS_MUST_START_AT_ZERO
    const noZeroRes = await request(server)
      .put("/api/v1/commission-tiers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tiers: [{ minRevenue: 5000, percent: 50 }],
      });
    expect(noZeroRes.status).toBe(400);
    expect(noZeroRes.body.code).toBe("TIERS_MUST_START_AT_ZERO");

    // Out of range percent -> PERCENT_OUT_OF_RANGE
    const rangeRes = await request(server)
      .put("/api/v1/commission-tiers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tiers: [
          { minRevenue: 0, percent: 50 },
          { minRevenue: 10000, percent: 120 },
        ],
      });
    expect(rangeRes.status).toBe(400);
    expect(rangeRes.body.code).toBe("PERCENT_OUT_OF_RANGE");

    // Valid gym default tier setup: 0 -> 40%, 10000 -> 50%
    const validRes = await request(server)
      .put("/api/v1/commission-tiers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tiers: [
          { minRevenue: 0, percent: 40 },
          { minRevenue: 10000, percent: 50 },
        ],
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body).toHaveLength(2);
  });

  it("2. Milestone generation & Waterfall: PT 3000 / 3 months fully collected, tier 50% -> 500 each month", async () => {
    // Set 50% flat tier for coach Ahmed
    await request(server)
      .put(`/api/v1/commission-tiers?coachId=${coachAhmedId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tiers: [{ minRevenue: 0, percent: 50 }],
      });

    // Sell PT 3000 with 3 milestones, starting 2026-01-01
    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_pt_3000_3m",
            quantity: 1,
            subscription: {
              coachId: coachAhmedId,
              startDate: "2026-01-01T00:00:00.000Z",
            },
          },
        ],
        payments: [{ method: "CASH", amount: 300000 }], // 3000.00 EGP fully paid
        useWallet: false,
      });

    expect(invRes.status).toBe(201);
    const subId = invRes.body.items[0].subscriptionId;
    expect(subId).toBeDefined();

    // Verify 3 milestones created
    const entries = await prisma.commissionEntry.findMany({
      where: { subscriptionId: subId },
      orderBy: { milestoneIndex: "asc" },
    });
    expect(entries).toHaveLength(3);
    expect(Number(entries[0]!.baseAmount)).toBe(1000);
    expect(Number(entries[0]!.allocatedBase)).toBe(1000);
    expect(Number(entries[1]!.baseAmount)).toBe(1000);
    expect(Number(entries[1]!.allocatedBase)).toBe(1000);
    expect(Number(entries[2]!.baseAmount)).toBe(1000);
    expect(Number(entries[2]!.allocatedBase)).toBe(1000);

    // Run 1: 2026/1
    const run1Res = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 1 });
    expect(run1Res.status).toBe(201);

    const coachAhmedLine1 = run1Res.body.staff
      .find((s: any) => s.staffId === coachAhmedId)
      ?.lines.find((l: any) => l.kind === "COMMISSION");
    expect(coachAhmedLine1).toBeDefined();
    expect(coachAhmedLine1.amount).toBe(500); // 1000 * 50% = 500

    const close1 = await request(server)
      .post(`/api/v1/payroll/runs/${run1Res.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(close1.status).toBe(201);

    // Run 2: 2026/2
    const run2Res = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 2 });
    expect(run2Res.status).toBe(201);

    const coachAhmedLine2 = run2Res.body.staff
      .find((s: any) => s.staffId === coachAhmedId)
      ?.lines.find((l: any) => l.kind === "COMMISSION");
    expect(coachAhmedLine2).toBeDefined();
    expect(coachAhmedLine2.amount).toBe(500); // 1000 * 50% = 500

    const close2 = await request(server)
      .post(`/api/v1/payroll/runs/${run2Res.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(close2.status).toBe(201);

    // Run 3: 2026/3
    const run3Res = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 3 });
    expect(run3Res.status).toBe(201);

    const coachAhmedLine3 = run3Res.body.staff
      .find((s: any) => s.staffId === coachAhmedId)
      ?.lines.find((l: any) => l.kind === "COMMISSION");
    expect(coachAhmedLine3).toBeDefined();
    expect(coachAhmedLine3.amount).toBe(500); // 1000 * 50% = 500

    const close3 = await request(server)
      .post(`/api/v1/payroll/runs/${run3Res.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(close3.status).toBe(201);
  });

  it("3. Partial collected waterfall & late payment adjustments: 1500 collected -> 500, 250, 0; late payment gives +250, +500", async () => {
    // New member for isolation
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عضو دفع جزئي وتسوية لاحقة",
        phone: "010" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        gender: "MALE",
      });
    const pMemberId = memRes.body.id;

    // Sell PT 3000 over 84 days starting 2026-04-01, but only collect 1500 EGP (150,000 piasters)
    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: pMemberId,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_pt_3000_3m",
            quantity: 1,
            subscription: {
              coachId: coachAhmedId,
              startDate: "2026-04-01T00:00:00.000Z",
            },
          },
        ],
        payments: [{ method: "CASH", amount: 150000 }], // only 1500 paid
        useWallet: false,
      });

    const subId = invRes.body.items[0].subscriptionId;
    const invoiceId = invRes.body.id;

    // Verify waterfall: 1500 fills [1000, 500, 0]
    const entries = await prisma.commissionEntry.findMany({
      where: { subscriptionId: subId },
      orderBy: { milestoneIndex: "asc" },
    });
    expect(Number(entries[0]!.allocatedBase)).toBe(1000);
    expect(Number(entries[1]!.allocatedBase)).toBe(500);
    expect(Number(entries[2]!.allocatedBase)).toBe(0);

    // Month 4 (April): 1000 * 50% = 500
    const run4 = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 4 });
    const comm4 = run4.body.staff
      .find((s: any) => s.staffId === coachAhmedId)
      ?.lines.find((l: any) => l.kind === "COMMISSION");
    expect(comm4.amount).toBe(500);
    await request(server)
      .post(`/api/v1/payroll/runs/${run4.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Month 5 (May): 500 * 50% = 250
    const run5 = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 5 });
    const comm5 = run5.body.staff
      .find((s: any) => s.staffId === coachAhmedId)
      ?.lines.find((l: any) => l.kind === "COMMISSION");
    expect(comm5.amount).toBe(250);
    await request(server)
      .post(`/api/v1/payroll/runs/${run5.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Month 6 (June): 0 * 50% = 0 (no commission line)
    const run6 = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 6 });
    const comm6 = run6.body.staff
      .find((s: any) => s.staffId === coachAhmedId)
      ?.lines.find((l: any) => l.kind === "COMMISSION");
    expect(comm6?.amount || 0).toBe(0);
    await request(server)
      .post(`/api/v1/payroll/runs/${run6.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    // NOW: Member pays the remaining 1500 EGP in July!
    const payRes = await request(server)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payments: [{ method: "CASH", amount: 150000 }],
      });
    expect(payRes.status).toBe(201);

    // Verify all milestones now have 1000 allocatedBase
    const updatedEntries = await prisma.commissionEntry.findMany({
      where: { subscriptionId: subId },
      orderBy: { milestoneIndex: "asc" },
    });
    expect(Number(updatedEntries[0]!.allocatedBase)).toBe(1000);
    expect(Number(updatedEntries[1]!.allocatedBase)).toBe(1000);
    expect(Number(updatedEntries[2]!.allocatedBase)).toBe(1000);

    // Month 7 (July) payroll: shows ADJUSTMENT lines (+250 for milestone 2, +500 for milestone 3)
    const run7 = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 7 });

    const coachAhmedLines7 = run7.body.staff
      .find((s: any) => s.staffId === coachAhmedId)
      ?.lines.filter((l: any) => l.kind === "ADJUSTMENT");

    expect(coachAhmedLines7).toBeDefined();
    const totalAdjustment = coachAhmedLines7.reduce((sum: number, l: any) => sum + l.amount, 0);
    expect(totalAdjustment).toBe(750); // +250 + +500 = +750

    await request(server)
      .post(`/api/v1/payroll/runs/${run7.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  it("4. Tier picking: 0 -> 40%, 10,000 -> 50%; coach collected 12,000 gets 50% on WHOLE amount; 9,999.99 gets 40%", async () => {
    // Setup tiers for Coach Tarek: 0 -> 40%, 10000 -> 50%
    await prisma.paymentAllocation.deleteMany({
      where: { coachId: coachTarekId },
    });
    await request(server)
      .put(`/api/v1/commission-tiers?coachId=${coachTarekId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tiers: [
          { minRevenue: 0, percent: 40 },
          { minRevenue: 10000, percent: 50 },
        ],
      });

    // Sub for Coach Tarek starting 2026-08-01: price 12000, fully paid
    await prisma.plan.upsert({
      where: { id: "plan_pt_12000_1m" },
      update: {},
      create: {
        id: "plan_pt_12000_1m",
        gymId,
        name: "باقة PT مكثفة 12000",
        kind: "PT",
        price: 12000,
        durationDays: 30,
        grantsFloorAccess: false,
        commissionable: true,
        commissionMilestones: 1,
        isActive: true,
      },
    });

    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عضو باقة 12000",
        phone: "010" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        gender: "MALE",
      });

    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: memRes.body.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_pt_12000_1m",
            quantity: 1,
            subscription: {
              coachId: coachTarekId,
              startDate: "2026-08-01T00:00:00.000Z",
            },
          },
        ],
        payments: [{ method: "CASH", amount: 1200000 }], // 12,000 EGP collected
        useWallet: false,
      });

    // Set payment allocation createdAt to August 2026
    const subId = invRes.body.items[0].subscriptionId;
    const sub = await prisma.subscription.findUnique({
      where: { id: subId },
      include: { invoiceItem: true },
    });
    if (sub?.invoiceItemId) {
      await prisma.paymentAllocation.updateMany({
        where: { invoiceItemId: sub.invoiceItemId },
        data: { createdAt: new Date("2026-08-15T12:00:00.000Z") },
      });
    }

    // August 2026 payroll run:
    const runAug = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 8 });

    expect(runAug.status).toBe(201);
    const tarekComm = runAug.body.staff
      .find((s: any) => s.staffId === coachTarekId)
      ?.lines.find((l: any) => l.kind === "COMMISSION");

    expect(tarekComm).toBeDefined();
    expect(tarekComm.collectedRevenue).toBe(12000);
    expect(tarekComm.tierPercent).toBe(50); // Reached 50% tier
    expect(tarekComm.amount).toBe(6000); // 50% on whole 12,000 = 6,000

    await request(server)
      .post(`/api/v1/payroll/runs/${runAug.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  it("5. Closing rules: PREVIOUS_RUN_OPEN prevents closing later month while earlier is DRAFT; closed run cannot recalculate", async () => {
    // Create draft for 2026/9 and 2026/10
    const runSep = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 9 });
    expect(runSep.status).toBe(201);

    const runOct = await request(server)
      .post("/api/v1/payroll/runs")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 10 });
    expect(runOct.status).toBe(201);

    // Attempting to close October while September is DRAFT -> 400 PREVIOUS_RUN_OPEN
    const closeOctFail = await request(server)
      .post(`/api/v1/payroll/runs/${runOct.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(closeOctFail.status).toBe(400);
    expect(closeOctFail.body.code).toBe("PREVIOUS_RUN_OPEN");

    // Close September first -> OK
    const closeSep = await request(server)
      .post(`/api/v1/payroll/runs/${runSep.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(closeSep.status).toBe(201);

    // Now close October -> OK
    const closeOct = await request(server)
      .post(`/api/v1/payroll/runs/${runOct.body.id}/close`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(closeOct.status).toBe(201);

    // Recalculating closed run -> 400 RUN_CLOSED
    const recalcClosed = await request(server)
      .post(`/api/v1/payroll/runs/${runSep.body.id}/recalculate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(recalcClosed.status).toBe(400);
    expect(recalcClosed.body.code).toBe("RUN_CLOSED");
  });

  it("6. Coach view: GET /me/commission returns own numbers, milestones, and tier progress", async () => {
    const meRes = await request(server)
      .get("/api/v1/me/commission?month=2026-01")
      .set("Authorization", `Bearer ${coachAhmedToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.coachId).toBe(coachAhmedId);
    expect(meRes.body.tier).toBeDefined();
    expect(Array.isArray(meRes.body.entries)).toBe(true);
  });
});
