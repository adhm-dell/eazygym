import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { evaluatePromotion } from "@gym/domain";

describe("B02 Catalog (Plans, Services, Products, Promotions) Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;
  let adminToken = "";
  let receptionToken = "";
  let createdPlanId = "";
  let createdPromotionId = "";
  const dynamicPromoCode = `W20_${Date.now()}`;
  const dynamicServiceName = `جلسة مساج وسبا ${Date.now()}`;
  const dynamicProductName = `مشروب طاقة طبيعي ${Date.now()}`;

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

  it("1. Validation: PT plan with commissionMilestones > months returns 400 INVALID_PLAN", async () => {
    // 30 days = 1 month, commissionMilestones: 3 is invalid (> 1)
    const res = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "خطة تدريب غير صالحة",
        kind: "PT",
        price: 200000,
        durationDays: 30,
        commissionMilestones: 3,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PLAN");
    expect(res.body.details?.fields).toContain("commissionMilestones");
  });

  it("2. Validation: freezeMaxCount > 0 with freezeMaxTotalDays = 0 returns 400 INVALID_PLAN", async () => {
    const res = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "خطة تجميد غير متطابقة",
        kind: "GYM",
        price: 100000,
        durationDays: 30,
        freezeMaxCount: 2,
        freezeMaxTotalDays: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_PLAN");
  });

  it("3. Plans: Successfully create valid plan and list active plans", async () => {
    const res = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "باقة النخبة 6 شهور",
        kind: "GYM",
        price: 450000, // 4,500.00 EGP
        durationDays: 180,
        grantsFloorAccess: true,
        freezeMaxCount: 3,
        freezeMaxTotalDays: 30,
        minUpfrontPercent: 40,
        dueAfterDays: 30,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("باقة النخبة 6 شهور");
    expect(res.body.price).toBe(450000);
    createdPlanId = res.body.id;

    // List plans
    const listRes = await request(server)
      .get("/api/v1/plans?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((p: any) => p.id === createdPlanId)).toBe(true);
  });

  it("4. Plans: Update plan price does not mutate existing subscriptions", async () => {
    // Update plan price to 500,000 piasters
    const updateRes = await request(server)
      .patch(`/api/v1/plans/${createdPlanId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        price: 500000,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.price).toBe(500000);
  });

  it("5. Plans: Archive plan marks it inactive without deleting", async () => {
    const archiveRes = await request(server)
      .post(`/api/v1/plans/${createdPlanId}/archive`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(archiveRes.status).toBe(201);

    const getRes = await request(server)
      .get(`/api/v1/plans/${createdPlanId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.isActive).toBe(false);

    // Verify archived plan does not appear in active plans (POS sell tab query)
    const activePlansRes = await request(server)
      .get("/api/v1/plans?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(activePlansRes.status).toBe(200);
    expect(activePlansRes.body.some((p: any) => p.id === createdPlanId)).toBe(false);
  });

  it("5b. Plans: Admin can restore an archived plan and it reappears in active plans", async () => {
    const restoreRes = await request(server)
      .post(`/api/v1/plans/${createdPlanId}/restore`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(restoreRes.status).toBe(201);

    const getRes = await request(server)
      .get(`/api/v1/plans/${createdPlanId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.isActive).toBe(true);

    // Verify restored plan reappears in active plans
    const activePlansRes = await request(server)
      .get("/api/v1/plans?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(activePlansRes.status).toBe(200);
    expect(activePlansRes.body.some((p: any) => p.id === createdPlanId)).toBe(true);
  });

  it("6. Services: Create and list pos-sellable services", async () => {
    const res = await request(server)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: dynamicServiceName,
        price: 15000,
        sellableAtPos: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(dynamicServiceName);
    expect(res.body.price).toBe(15000);
    const serviceId = res.body.id;

    // Duplicate service name -> 409 SERVICE_EXISTS
    const duplicateRes = await request(server)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: dynamicServiceName,
        price: 20000,
        sellableAtPos: true,
      });
    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.code).toBe("SERVICE_EXISTS");

    // List active services -> appears
    const listRes = await request(server)
      .get("/api/v1/services?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.some((s: any) => s.name === dynamicServiceName)).toBe(true);

    // Deactivate service -> disappears from active list
    const deactivateRes = await request(server)
      .patch(`/api/v1/services/${serviceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(200);

    const listAfterDeactivate = await request(server)
      .get("/api/v1/services?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(listAfterDeactivate.status).toBe(200);
    expect(listAfterDeactivate.body.some((s: any) => s.id === serviceId)).toBe(false);
  });

  it("7. Products: Create retail product with stock, handle duplicate and update inventory", async () => {
    const res = await request(server)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: dynamicProductName,
        price: 8500,
        stock: 50,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe(dynamicProductName);
    expect(res.body.stock).toBe(50);
    const prodId = res.body.id;

    // Duplicate product name -> 409 PRODUCT_EXISTS
    const duplicateRes = await request(server)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: dynamicProductName,
        price: 9000,
        stock: 10,
      });
    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.code).toBe("PRODUCT_EXISTS");

    // Update stock
    const updateRes = await request(server)
      .patch(`/api/v1/products/${prodId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        stock: 45,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.stock).toBe(45);
  });

  it("8. Promotions: Create promotion with 20% discount code", async () => {
    const res = await request(server)
      .post("/api/v1/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "خصم الجمعة البيضاء 20%",
        code: dynamicPromoCode,
        type: "PERCENT",
        value: 20,
        maxDiscount: 50000, // 500.00 EGP cap
        minSubtotal: 100000, // 1,000.00 EGP minimum
        itemKinds: ["SUBSCRIPTION"],
        maxUses: 100,
        perMemberLimit: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(dynamicPromoCode);
    createdPromotionId = res.body.id;
  });

  it("9. Promotions Preview: Wrong promo code returns 422 WRONG_CODE", async () => {
    const res = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: "INVALID_CODE_XYZ",
        items: [{ id: "item_1", kind: "SUBSCRIPTION", total: 200000 }],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("WRONG_CODE");
  });

  it("10. Promotions Preview: Below minimum subtotal returns 422 BELOW_MIN_SUBTOTAL", async () => {
    // Minimum is 100,000 piasters. Cart item is 50,000 piasters.
    const res = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: dynamicPromoCode,
        items: [{ id: "item_1", kind: "SUBSCRIPTION", total: 50000 }],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("BELOW_MIN_SUBTOTAL");
  });

  it("11. Promotions Preview: Valid promo computes exact pro-rata discount split", async () => {
    // 2 eligible items totaling 200,000 piasters: 120,000 and 80,000
    // 20% discount = 40,000 piasters
    // item 1 split = 24,000, item 2 split = 16,000
    const res = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: dynamicPromoCode,
        items: [
          { id: "item_1", kind: "SUBSCRIPTION", total: 120000 },
          { id: "item_2", kind: "SUBSCRIPTION", total: 80000 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.applicable).toBe(true);
    expect(res.body.discount).toBe(40000);
    expect(res.body.perItem).toEqual([
      { id: "item_1", discount: 24000 },
      { id: "item_2", discount: 16000 },
    ]);
  });

  it("12. Promotions: Deactivate promotion and verify preview fails with 422 INACTIVE", async () => {
    await request(server)
      .post(`/api/v1/promotions/${createdPromotionId}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(201);

    const res = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: dynamicPromoCode,
        items: [{ id: "item_1", kind: "SUBSCRIPTION", total: 200000 }],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("INACTIVE");
  });

  it("13. Phase 06c Acceptance: Code-only promo limited to one plan, 1 use per member", async () => {
    // 1. Create a plan first to link to
    const planRes = await request(server)
      .post("/api/v1/plans")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `باقة قبول العروض ${Date.now()}`,
        kind: "GYM",
        price: 150000, // 1,500.00 EGP
        durationDays: 30,
      })
      .expect(201);
    const targetPlanId = planRes.body.id;

    // 2. Create code-only promo restricted to that plan with perMemberLimit = 1
    const oneOffCode = `ONEOFF_${Date.now()}`;
    const promoRes = await request(server)
      .post("/api/v1/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "عرض خاص باقة محددة واستخدام واحد",
        code: oneOffCode,
        type: "PERCENT",
        value: 20, // 20%
        itemKinds: ["SUBSCRIPTION"],
        planIds: [targetPlanId],
        perMemberLimit: 1,
      })
      .expect(201);
    const promoId = promoRes.body.id;

    // 3. POS preview for that plan with correct code -> applies
    const validPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: oneOffCode,
        memberId: "mem_01",
        items: [{ id: "cart_item_1", kind: "SUBSCRIPTION", planId: targetPlanId, total: 150000 }],
      })
      .expect(201);

    expect(validPreview.body.applicable).toBe(true);
    expect(validPreview.body.discount).toBe(30000); // 20% of 150,000 = 30,000
    expect(validPreview.body.perItem).toEqual([{ id: "cart_item_1", discount: 30000 }]);

    // 4. POS preview for that plan without code or with wrong code -> shows WRONG_CODE
    const wrongCodePreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: "INCORRECT_CODE",
        memberId: "mem_01",
        items: [{ id: "cart_item_1", kind: "SUBSCRIPTION", planId: targetPlanId, total: 150000 }],
      })
      .expect(422);

    expect(wrongCodePreview.body.code).toBe("WRONG_CODE");

    // Also calling without code -> WRONG_CODE
    const noCodePreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: "NONE_EXISTENT",
        memberId: "mem_01",
        items: [{ id: "cart_item_1", kind: "SUBSCRIPTION", planId: targetPlanId, total: 150000 }],
      })
      .expect(422);

    expect(noCodePreview.body.code).toBe("WRONG_CODE");

    // 5. POS preview with a different plan -> NOTHING_ELIGIBLE
    const diffPlanPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: oneOffCode,
        memberId: "mem_01",
        items: [{ id: "cart_item_1", kind: "SUBSCRIPTION", planId: "some_other_plan_id", total: 150000 }],
      })
      .expect(422);

    expect(diffPlanPreview.body.code).toBe("NOTHING_ELIGIBLE");

    // 6. Record a redemption for mem_01 in database on a dedicated new invoice
    const invRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        memberId: "mem_01",
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: targetPlanId,
            quantity: 1,
            subscription: {
              startDate: new Date().toISOString(),
            },
          },
        ],
        payments: [{ method: "CASH", amount: 150000 }],
        useWallet: false,
      })
      .expect(201);

    await prisma.promotionRedemption.create({
      data: {
        gymId: "gym_cairo_01",
        promotionId: promoId,
        memberId: "mem_01",
        invoiceId: invRes.body.id,
        amount: 300, // 300 EGP (decimal)
      },
    });

    // 7. POS preview for mem_01 who used it -> MEMBER_LIMIT_REACHED
    const limitReachedRes = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: oneOffCode,
        memberId: "mem_01",
        items: [{ id: "cart_item_1", kind: "SUBSCRIPTION", planId: targetPlanId, total: 150000 }],
      })
      .expect(422);

    expect(limitReachedRes.body.code).toBe("MEMBER_LIMIT_REACHED");

    // 8. But another member mem_02 who has not used it yet CAN still apply it
    const otherMemberPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: oneOffCode,
        memberId: "mem_02",
        items: [{ id: "cart_item_1", kind: "SUBSCRIPTION", planId: targetPlanId, total: 150000 }],
      })
      .expect(201);

    expect(otherMemberPreview.body.applicable).toBe(true);
    expect(otherMemberPreview.body.discount).toBe(30000);
  });

  it("14. Phase 06c Acceptance: Dialog preview (evaluatePromotion) and POS give identical numbers", async () => {
    // Arbitrary multi-item cart
    const cart = [
      { id: "cart_1", kind: "SUBSCRIPTION" as const, planId: "plan_pt_12", total: 300000 },
      { id: "cart_2", kind: "SERVICE" as const, total: 35000 },
      { id: "cart_3", kind: "PRODUCT" as const, total: 8500 },
    ];

    const promoCode = `PROMO_IDENT_${Date.now()}`;
    await request(server)
      .post("/api/v1/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "عرض تطابق الحسابات",
        code: promoCode,
        type: "PERCENT",
        value: 15,
        maxDiscount: 50000,
        minSubtotal: 100000,
        itemKinds: ["SUBSCRIPTION", "SERVICE"],
      })
      .expect(201);

    // Call POS preview endpoint
    const apiPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: promoCode,
        items: cart,
      })
      .expect(201);

    // Call local evaluatePromotion (same function as Dialog preview)
    const localResult = evaluatePromotion({
      promo: {
        type: "PERCENT",
        value: 15,
        maxDiscount: 50000,
        minSubtotal: 100000,
        itemKinds: ["SUBSCRIPTION", "SERVICE"],
        planIds: [],
        isActive: true,
        code: promoCode,
      },
      items: cart,
      now: new Date(),
      enteredCode: promoCode,
      totalRedemptions: 0,
      memberRedemptions: 0,
    });

    expect(apiPreview.body.applicable).toBe(localResult.applicable);
    expect(apiPreview.body.discount).toBe(localResult.discount);
    expect(apiPreview.body.perItem).toEqual(localResult.perItem);
  });
});
