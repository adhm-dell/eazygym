import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";

describe("B06 Shifts & Expenses Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let adminToken = "";
  let barToken = "";
  let receptionToken = "";
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

    // Login Bar Cashier
    const barLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "bar@powercore.gym", password: "123456" });
    barToken = barLogin.body.accessToken;

    // Create a fresh test member
    const memRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "عضو اختبار الورديات",
        phone: "010" + Math.floor(10000000 + Math.random() * 90000000).toString(),
        gender: "MALE",
      });
    memberId = memRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Acceptance: Opening 500, cash sales 2000, receipt 300, expense 150, disbursement 100 -> expected 2550; counted 2500 -> variance -50 EGP", async () => {
    // 1. Bar cashier opens shift with 500.00 EGP (50,000 piasters)
    // First ensure bar cashier has no open shift (close if any)
    const currentShift = await request(server)
      .get("/api/v1/shifts/current")
      .set("Authorization", `Bearer ${barToken}`);

    if (currentShift.body) {
      await request(server)
        .post(`/api/v1/shifts/${currentShift.body.id}/close`)
        .set("Authorization", `Bearer ${barToken}`)
        .send({ countedCash: currentShift.body.openingCash });
    }

    const openRes = await request(server)
      .post("/api/v1/shifts/open")
      .set("Authorization", `Bearer ${barToken}`)
      .send({ openingCash: 50000 });

    expect(openRes.status).toBe(201);
    const shiftId = openRes.body.id;

    // 2. Cash sales: 2000.00 EGP (200,000 piasters) -> e.g. Gold plan paid fully in cash
    await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        memberId,
        items: [{ kind: "SUBSCRIPTION", planId: "plan_gold_01", quantity: 1 }],
        payments: [{ method: "CASH", amount: 200000 }],
        useWallet: false,
      })
      .expect(201);

    // 3. Cash Receipt Voucher: 300.00 EGP (30,000 piasters)
    await request(server)
      .post("/api/v1/vouchers/receipt")
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        memberId,
        amount: 30000,
        method: "CASH",
        reason: "إيداع رسوم تأمين خزانة",
      })
      .expect(201);

    // 4. Operational Expense from drawer: 150.00 EGP (15,000 piasters)
    await request(server)
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        category: "نظافة وضيافة",
        amount: 15000,
        description: "شراء أدوات نظافة فورية من السوبرماركت",
        paidFromDrawer: true,
      })
      .expect(201);

    // 5. Cash Disbursement Voucher: 100.00 EGP (10,000 piasters)
    await request(server)
      .post("/api/v1/vouchers/disbursement")
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        memberId,
        amount: 10000,
        method: "CASH",
        reason: "استرداد تأمين خزانة",
      })
      .expect(201);

    // 6. Check live summary:
    // Expected: 50,000 + 200,000 + 30,000 - 15,000 - 10,000 = 255,000 piasters
    const checkLive = await request(server)
      .get("/api/v1/shifts/current")
      .set("Authorization", `Bearer ${barToken}`);

    expect(checkLive.status).toBe(200);
    expect(checkLive.body.expectedCash).toBe(255000);
    expect(checkLive.body.cashPayments).toBe(200000);
    expect(checkLive.body.cashReceiptVouchers).toBe(30000);
    expect(checkLive.body.expensesFromDrawer).toBe(15000);
    expect(checkLive.body.cashDisbursementVouchers).toBe(10000);

    // 7. Close shift with counted 2500.00 EGP (250,000 piasters)
    // Variance: 250,000 - 255,000 = -5,000 piasters (shortage)
    const closeRes = await request(server)
      .post(`/api/v1/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        countedCash: 250000,
        note: "عجز 50 جنيه جاري مراجعته مع الكاميرات",
      });

    expect(closeRes.status).toBe(201);
    expect(closeRes.body.status).toBe("CLOSED");
    expect(closeRes.body.expectedCash).toBe(255000);
    expect(closeRes.body.countedCash).toBe(250000);
    expect(closeRes.body.variance).toBe(-5000);
  });

  it("2. Non-cash tender: Instapay 1000 EGP does not affect expected cash", async () => {
    // Open a fresh shift for bar cashier
    const openRes = await request(server)
      .post("/api/v1/shifts/open")
      .set("Authorization", `Bearer ${barToken}`)
      .send({ openingCash: 10000 }); // 100.00 EGP

    const shiftId = openRes.body.id;

    // Payment by INSTAPAY 1000.00 EGP (100,000 piasters)
    await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        memberId,
        items: [{ kind: "SERVICE", serviceId: "srv_inbody", quantity: 1, unitPrice: 100000 }],
        payments: [{ method: "INSTAPAY", amount: 100000 }],
        useWallet: false,
      })
      .expect(201);

    const checkLive = await request(server)
      .get("/api/v1/shifts/current")
      .set("Authorization", `Bearer ${barToken}`);

    // Expected cash stays opening cash (10,000 piasters), instapay shows separately
    expect(checkLive.body.expectedCash).toBe(10000);
    expect(checkLive.body.instapayPayments).toBe(100000);

    // Close shift
    await request(server)
      .post(`/api/v1/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${barToken}`)
      .send({ countedCash: 10000 })
      .expect(201);
  });

  it("3. Shift Ownership: Reception cannot close Bar shift (403 NOT_OWNER), but Admin can", async () => {
    // Open shift by Bar
    const openRes = await request(server)
      .post("/api/v1/shifts/open")
      .set("Authorization", `Bearer ${barToken}`)
      .send({ openingCash: 20000 });
    const shiftId = openRes.body.id;

    // Reception attempts to close -> 403 NOT_OWNER
    const recClose = await request(server)
      .post(`/api/v1/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ countedCash: 20000 });

    expect(recClose.status).toBe(403);
    expect(recClose.body.code).toBe("NOT_OWNER");

    // Admin closes Bar shift -> OK
    const adminClose = await request(server)
      .post(`/api/v1/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ countedCash: 20000, note: "أغلقت بواسطة الأدمن" });

    expect(adminClose.status).toBe(201);
    expect(adminClose.body.status).toBe("CLOSED");
  });

  it("4. Close-all: Admin closes all open shifts without physical count", async () => {
    // Open shift for Bar
    await request(server)
      .post("/api/v1/shifts/open")
      .set("Authorization", `Bearer ${barToken}`)
      .send({ openingCash: 15000 });

    // Admin closes all
    const closeAllRes = await request(server)
      .post("/api/v1/shifts/close-all")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ note: "إغلاق نهاية اليوم الشامل" });

    expect(closeAllRes.status).toBe(201);
    expect(Array.isArray(closeAllRes.body)).toBe(true);
    expect(closeAllRes.body.length).toBeGreaterThanOrEqual(1);

    const barClosed = closeAllRes.body.find((s: any) => s.staffId === "staff_cashier");
    if (barClosed) {
      expect(barClosed.status).toBe("CLOSED");
      expect(barClosed.countedCash).toBeNull();
      expect(barClosed.variance).toBeNull();
    }
  });

  it("5. Guard: Recording expense with no open shift throws 422 NO_OPEN_SHIFT", async () => {
    // Bar has no open shift now (closed by close-all above)
    const expenseRes = await request(server)
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        category: "صيانة",
        amount: 5000,
        description: "تصليح فيش كهرباء",
      });

    expect(expenseRes.status).toBe(422);
    expect(expenseRes.body.code).toBe("NO_OPEN_SHIFT");
  });

  it("6. Void Expense: Voided expense is excluded from drawer expected cash", async () => {
    // Bar opens shift with 300.00 EGP (30,000 piasters)
    await request(server)
      .post("/api/v1/shifts/open")
      .set("Authorization", `Bearer ${barToken}`)
      .send({ openingCash: 30000 })
      .expect(201);

    // Create expense 100.00 EGP (10,000 piasters)
    const expRes = await request(server)
      .post("/api/v1/expenses")
      .set("Authorization", `Bearer ${barToken}`)
      .send({
        category: "مشتريات",
        amount: 10000,
        description: "شراء بن للبار",
      })
      .expect(201);
    const expenseId = expRes.body.id;

    // Expected cash was reduced by 10,000 -> 20,000
    const live1 = await request(server)
      .get("/api/v1/shifts/current")
      .set("Authorization", `Bearer ${barToken}`);
    expect(live1.body.expectedCash).toBe(20000);

    // Admin voids expense
    const voidRes = await request(server)
      .post(`/api/v1/expenses/${expenseId}/void`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "إلغاء لخطأ في السعر المدخل" });

    expect(voidRes.status).toBe(201);
    expect(voidRes.body.voidReason).toBe("إلغاء لخطأ في السعر المدخل");

    // Expected cash is restored to 30,000 piasters!
    const live2 = await request(server)
      .get("/api/v1/shifts/current")
      .set("Authorization", `Bearer ${barToken}`);
    expect(live2.body.expectedCash).toBe(30000);
  });
});
