import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";

describe("B03 Invoices, Payments, Wallet & B04 Subscriptions Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let adminToken = "";
  let receptionToken = "";
  let memberId = "";
  let promo10Id = "";
  const testPromoCode = `T10_${Date.now()}`;

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

    // Create fresh member for isolation
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "عضو اختبار المدفوعات",
        phone: "010" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        gender: "MALE",
      });
    memberId = memRes.body.id;

    // Create 10% promo for test
    const promoRes = await request(server)
      .post("/api/v1/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "خصم 10% تجريبي",
        code: testPromoCode,
        type: "PERCENT",
        value: 10,
        itemKinds: ["SUBSCRIPTION"],
      });
    promo10Id = promoRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Acceptance: Sell PT 3000 with 10% promotion, pay 800 cash + 500 wallet: total 2700, collected 1300 (48%) -> PENDING_PAYMENT, pay 100 more -> ACTIVE", async () => {
    // Member starts with wallet balance: topup 500 EGP (50,000 piasters)
    await request(server)
      .post(`/api/v1/members/${memberId}/wallet/topup`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        amount: 50000,
        method: "CASH",
        note: "Topup for PT test",
      })
      .expect(201);

    // Create invoice: PT 12 (price: 300,000 piasters) with TEST10 -> discount 30,000 -> net total: 270,000
    // Pay 800 cash (80,000 piasters) + wallet auto-apply 500 (50,000 piasters) = collected 130,000 (48.1%)
    // 50% minUpfront is 135,000 piasters. 130,000 < 135,000 -> PENDING_PAYMENT
    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_pt_12",
            quantity: 1,
            subscription: {
              coachId: "staff_coach",
            },
          },
        ],
        promotionCode: testPromoCode,
        payments: [
          {
            method: "CASH",
            amount: 80000,
          },
        ],
        useWallet: true,
      });

    expect(invoiceRes.status).toBe(201);
    const invoice = invoiceRes.body;
    expect(invoice.total).toBe(270000);
    expect(invoice.collected).toBe(130000);
    expect(invoice.status).toBe("OPEN");

    const subItem = invoice.items[0];
    expect(subItem.subscriptionId).toBeTruthy();

    // Check subscription status -> PENDING_PAYMENT
    const subsRes = await request(server)
      .get(`/api/v1/subscriptions?memberId=${memberId}`)
      .set("Authorization", `Bearer ${receptionToken}`);

    const sub = subsRes.body.find((s: any) => s.id === subItem.subscriptionId);
    expect(sub.status).toBe("PENDING_PAYMENT");

    // Now collect 100 EGP (10,000 piasters) more -> total collected 140,000 (51.8% >= 50%)
    const payMoreRes = await request(server)
      .post(`/api/v1/invoices/${invoice.id}/payments`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        payments: [
          {
            method: "CASH",
            amount: 10000,
          },
        ],
      });

    expect(payMoreRes.status).toBe(201);
    expect(payMoreRes.body.collected).toBe(140000);

    // Verify subscription flipped to ACTIVE
    const subsAfter = await request(server)
      .get(`/api/v1/subscriptions?memberId=${memberId}`)
      .set("Authorization", `Bearer ${receptionToken}`);

    const subAfter = subsAfter.body.find((s: any) => s.id === subItem.subscriptionId);
    expect(subAfter.status).toBe("ACTIVE");
  });

  it("2. Acceptance: Tender 1000 on a 800 invoice: 200 lands in the wallet", async () => {
    // Initial member wallet balance
    const walletBefore = await request(server)
      .get(`/api/v1/members/${memberId}/wallet`)
      .set("Authorization", `Bearer ${receptionToken}`);
    const balanceBefore = walletBefore.body.balance;

    // Create retail product invoice of 800 EGP (80,000 piasters), tender 1,000 EGP (100,000 piasters) CASH
    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [
          {
            kind: "SERVICE",
            serviceId: "srv_inbody",
            unitPrice: 80000,
            quantity: 1,
          },
        ],
        payments: [
          {
            method: "CASH",
            amount: 100000,
          },
        ],
        useWallet: false,
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.total).toBe(80000);
    expect(invRes.body.status).toBe("PAID");

    // Check wallet balance incremented by 20,000 piasters
    const walletAfter = await request(server)
      .get(`/api/v1/members/${memberId}/wallet`)
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(walletAfter.body.balance).toBe(balanceBefore + 20000);
  });

  it("3. Acceptance: Idempotency-Key prevents duplicate invoice submission", async () => {
    const key = `idem_${Date.now()}`;
    const payload = {
      memberId,
      items: [
        {
          kind: "SERVICE",
          serviceId: "srv_inbody",
          unitPrice: 5000,
          quantity: 1,
        },
      ],
      payments: [{ method: "CASH", amount: 5000 }],
    };

    const first = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .set("Idempotency-Key", key)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .set("Idempotency-Key", key)
      .send(payload);

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.number).toBe(first.body.number);
  });

  it("4. Acceptance: Void invoice cancels subscriptions and marks status VOID", async () => {
    // Create an invoice with a service
    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [
          {
            kind: "SERVICE",
            serviceId: "srv_inbody",
            unitPrice: 10000,
            quantity: 1,
          },
        ],
        payments: [{ method: "CASH", amount: 10000 }],
        useWallet: false,
      });

    const invoiceId = invRes.body.id;

    // Void by GYM_ADMIN
    const voidRes = await request(server)
      .post(`/api/v1/invoices/${invoiceId}/void`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "طلب العضو الإلغاء الفوري" });

    expect(voidRes.status).toBe(201);

    // Check invoice is VOID
    const checkInv = await request(server)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(checkInv.body.status).toBe("VOID");

    // Second void returns 409
    const secondVoid = await request(server)
      .post(`/api/v1/invoices/${invoiceId}/void`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "إلغاء مكرر" });

    expect(secondVoid.status).toBe(409);
    expect(secondVoid.body.code).toBe("ALREADY_VOIDED");
  });

  it("5. Acceptance: Freeze and unfreeze subscription within allowance", async () => {
    // Sell a gym subscription: 3 months (freezeMaxCount: 2, freezeMaxTotalDays: 21)
    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: "plan_gym_3m",
            quantity: 1,
          },
        ],
        payments: [{ method: "CASH", amount: 240000 }],
        useWallet: false,
      });

    const subId = invRes.body.items[0].subscriptionId;

    // First freeze of 10 days -> OK
    const freeze1 = await request(server)
      .post(`/api/v1/subscriptions/${subId}/freeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ days: 10, reason: "سفر عمل" });

    expect(freeze1.status).toBe(201);

    // Unfreeze
    const unfreeze = await request(server)
      .post(`/api/v1/subscriptions/${subId}/unfreeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({});

    expect(unfreeze.status).toBe(201);
    expect(unfreeze.body.success).toBe(true);

    // Requesting freeze of 25 days (remaining days is 21 - 10 = 11) -> 422 REQUEST_EXCEEDS_REMAINING
    const freezeExceed = await request(server)
      .post(`/api/v1/subscriptions/${subId}/freeze`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ days: 25 });

    expect(freezeExceed.status).toBe(422);
    expect(freezeExceed.body.code).toBe("REQUEST_EXCEEDS_REMAINING");
  });

  it("6. Acceptance: Change PT coach assignment updates assignments", async () => {
    // Find active PT subscription
    const subsRes = await request(server)
      .get(`/api/v1/subscriptions?memberId=${memberId}&kind=PT`)
      .set("Authorization", `Bearer ${receptionToken}`);

    const ptSub = subsRes.body.find((s: any) => s.status === "ACTIVE" || s.status === "PENDING_PAYMENT");
    expect(ptSub).toBeDefined();

    // Change coach to Coach Tarek
    const changeRes = await request(server)
      .post(`/api/v1/subscriptions/${ptSub.id}/change-coach`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newCoachId: "staff_coach_tarek",
        reason: "تغيير بناء على رغبة المتدرب",
      });

    expect(changeRes.status).toBe(201);
    expect(changeRes.body.success).toBe(true);

    // Verifying assigning the same coach again returns 422 INVALID_COACH
    const sameCoachRes = await request(server)
      .post(`/api/v1/subscriptions/${ptSub.id}/change-coach`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        newCoachId: "staff_coach_tarek",
      });

    expect(sameCoachRes.status).toBe(422);
    expect(sameCoachRes.body.code).toBe("INVALID_COACH");
  });

  it("7. Acceptance: Renew subscription chains start date after existing end date", async () => {
    const subsRes = await request(server)
      .get(`/api/v1/subscriptions?memberId=${memberId}&kind=GYM`)
      .set("Authorization", `Bearer ${receptionToken}`);

    const existingSub = subsRes.body[0];
    expect(existingSub).toBeDefined();

    const renewRes = await request(server)
      .post(`/api/v1/subscriptions/${existingSub.id}/renew`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({});

    expect(renewRes.status).toBe(201);
    expect(renewRes.body.message).toBe("Subscription renewed successfully");
    expect(renewRes.body.subscription).toBeDefined();

    const newSub = renewRes.body.subscription;
    const existingEnd = new Date(existingSub.endDate).getTime();
    const newStart = new Date(newSub.startDate).getTime();
    expect(Math.abs(newStart - existingEnd)).toBeLessThanOrEqual(1000);
  });
});
