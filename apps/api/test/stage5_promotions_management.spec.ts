import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { evaluatePromotion } from "@gym/domain";

describe("Stage 5: Promotions Management Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let adminToken = "";
  let receptionToken = "";
  let gymId = "";
  let testPlanId = "";
  let otherPlanId = "";
  let memberAId = "";
  let memberBId = "";

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
    gymId = adminLogin.body.user.gymId;

    // Login Reception
    const recLogin = await request(server)
      .post("/api/v1/auth/login")
      .send({ email: "reception@powercore.gym", password: "123456" });
    receptionToken = recLogin.body.accessToken;

    // Retrieve plans for testing
    const plansRes = await request(server)
      .get("/api/v1/plans?active=true")
      .set("Authorization", `Bearer ${adminToken}`);
    const plans = plansRes.body;
    expect(plans.length).toBeGreaterThanOrEqual(2);
    testPlanId = plans[0].id;
    otherPlanId = plans[1].id;

    // Create 2 test members for per-member limit checks
    const uniqueSuffix = Date.now().toString().slice(-4);
    const memberARes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `متدرب تجربة أ ${uniqueSuffix}`,
        phone: `0100${uniqueSuffix}11`,
        gender: "MALE",
      });
    memberAId = memberARes.body.id;

    const memberBRes = await request(server)
      .post("/api/v1/members")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `متدرب تجربة ب ${uniqueSuffix}`,
        phone: `0100${uniqueSuffix}22`,
        gender: "FEMALE",
      });
    memberBId = memberBRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  let promoId = "";
  const promoCode = `VIP${Date.now().toString().slice(-4)}`;

  it("1. Acceptance: Create code-only promotion limited to one plan and one use per member", async () => {
    const res = await request(server)
      .post("/api/v1/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `عرض كود مخصص ${promoCode}`,
        code: promoCode,
        type: "PERCENT",
        value: 20, // 20%
        planIds: [testPlanId],
        itemKinds: ["SUBSCRIPTION"],
        perMemberLimit: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.code).toBe(promoCode);
    expect(res.body.type).toBe("PERCENT");
    expect(res.body.value).toBe(20);
    expect(res.body.planIds).toContain(testPlanId);
    expect(res.body.perMemberLimit).toBe(1);
    expect(res.body.isActive).toBe(true);
    promoId = res.body.id;

    // Verify it appears in the list
    const listRes = await request(server)
      .get("/api/v1/promotions")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const found = listRes.body.find((p: any) => p.id === promoId);
    expect(found).toBeDefined();
    expect(found.code).toBe(promoCode);

    // Check usage stats initially
    const usageRes = await request(server)
      .get(`/api/v1/promotions/${promoId}/usage`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(usageRes.status).toBe(200);
    expect(usageRes.body.redemptionsCount).toBe(0);
    expect(usageRes.body.totalDiscount).toBe(0);
  });

  it("2. Acceptance: Duplicate code returns 409 Conflict (case-insensitive)", async () => {
    const dupRes = await request(server)
      .post("/api/v1/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "عرض مكرر",
        code: promoCode.toLowerCase(), // case-insensitive check
        type: "PERCENT",
        value: 10,
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe("PROMOTION_CODE_EXISTS");
  });

  it("3. Acceptance: Live preview and POS parity; checks denial reasons (WRONG_CODE, NOTHING_ELIGIBLE)", async () => {
    // 3a. Preview with eligible plan and correct code
    const eligibleCartItem = {
      id: "item-1",
      kind: "SUBSCRIPTION" as const,
      planId: testPlanId,
      total: 100000, // 1,000.00 EGP in piasters
    };

    const previewOk = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: promoCode,
        memberId: memberAId,
        items: [eligibleCartItem],
      });

    expect(previewOk.status).toBe(201);
    expect(previewOk.body.applicable).toBe(true);
    expect(previewOk.body.promotionId).toBe(promoId);
    // 20% of 100,000 piasters = 20,000 piasters
    expect(previewOk.body.discount).toBe(20000);
    expect(previewOk.body.perItem).toEqual([{ id: "item-1", discount: 20000 }]);

    // Verify parity with domain's evaluatePromotion
    const domainResult = evaluatePromotion({
      promo: {
        type: "PERCENT",
        value: 20,
        itemKinds: ["SUBSCRIPTION"],
        planIds: [testPlanId],
        perMemberLimit: 1,
        isActive: true,
        code: promoCode,
      },
      items: [eligibleCartItem],
      now: new Date(),
      enteredCode: promoCode,
      totalRedemptions: 0,
      memberRedemptions: 0,
    });

    expect(previewOk.body.discount).toBe(domainResult.discount);
    expect(previewOk.body.perItem).toEqual(domainResult.perItem);

    // 3b. Preview with wrong code returns 422 WRONG_CODE
    const wrongCodeRes = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: "INVALID_CODE_999",
        memberId: memberAId,
        items: [eligibleCartItem],
      });
    expect(wrongCodeRes.status).toBe(422);
    expect(wrongCodeRes.body.code).toBe("WRONG_CODE");

    // 3c. Preview without code when promotion requires code
    const noCodeRes = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        promotionId: promoId, // specify promotion directly without entering code
        memberId: memberAId,
        items: [eligibleCartItem],
      });
    expect(noCodeRes.status).toBe(422);
    expect(noCodeRes.body.code).toBe("WRONG_CODE");

    // 3d. Preview with non-eligible plan returns 422 NOTHING_ELIGIBLE
    const wrongPlanRes = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: promoCode,
        memberId: memberAId,
        items: [
          {
            id: "item-2",
            kind: "SUBSCRIPTION" as const,
            planId: otherPlanId,
            total: 50000,
          },
        ],
      });
    expect(wrongPlanRes.status).toBe(422);
    expect(wrongPlanRes.body.code).toBe("NOTHING_ELIGIBLE");
  });

  it("4. Acceptance: Single-use per member enforcement in POS sale and member limit check", async () => {
    // 4a. Member A completes a checkout using the promotion
    const invoiceRes = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        memberId: memberAId,
        promotionCode: promoCode,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: testPlanId,
            unitPrice: 100000,
            quantity: 1,
            subscription: {
              startDate: new Date().toISOString(),
            },
          },
        ],
        payments: [
          {
            method: "CASH",
            amount: 80000, // 100,000 - 20,000 discount
          },
        ],
      });

    expect(invoiceRes.status).toBe(201);
    expect(invoiceRes.body.discount).toBe(20000);
    expect(invoiceRes.body.promotion).toBeDefined();
    expect(invoiceRes.body.promotion.id).toBe(promoId);

    // 4b. Member A tries to use the same promotion again -> MEMBER_LIMIT_REACHED
    const memberAPreview2 = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: promoCode,
        memberId: memberAId,
        items: [
          {
            id: "item-3",
            kind: "SUBSCRIPTION",
            planId: testPlanId,
            total: 100000,
          },
        ],
      });
    expect(memberAPreview2.status).toBe(422);
    expect(memberAPreview2.body.code).toBe("MEMBER_LIMIT_REACHED");

    // 4c. Member B (who has NOT used it) CAN use the promotion
    const memberBPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: promoCode,
        memberId: memberBId,
        items: [
          {
            id: "item-4",
            kind: "SUBSCRIPTION",
            planId: testPlanId,
            total: 100000,
          },
        ],
      });
    expect(memberBPreview.status).toBe(201);
    expect(memberBPreview.body.applicable).toBe(true);

    // 4d. Usage endpoint reflects 1 redemption and 20,000 piasters total discount
    const usageRes = await request(server)
      .get(`/api/v1/promotions/${promoId}/usage`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(usageRes.status).toBe(200);
    expect(usageRes.body.redemptionsCount).toBe(1);
    expect(usageRes.body.totalDiscount).toBe(20000);
  });

  it("5. Acceptance: Deactivate and Reactivate flow with confirmation parity", async () => {
    // 5a. Deactivate promotion
    const deactRes = await request(server)
      .post(`/api/v1/promotions/${promoId}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(deactRes.status).toBe(201);
    expect(deactRes.body.success).toBe(true);

    // Verify promotion is now INACTIVE
    const deactPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: promoCode,
        memberId: memberBId,
        items: [
          {
            id: "item-5",
            kind: "SUBSCRIPTION",
            planId: testPlanId,
            total: 100000,
          },
        ],
      });
    expect(deactPreview.status).toBe(422);
    expect(deactPreview.body.code).toBe("INACTIVE");

    // 5b. Reactivate promotion
    const actRes = await request(server)
      .post(`/api/v1/promotions/${promoId}/activate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(actRes.status).toBe(201);
    expect(actRes.body.success).toBe(true);

    // Verify promotion is now applicable again
    const actPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        code: promoCode,
        memberId: memberBId,
        items: [
          {
            id: "item-6",
            kind: "SUBSCRIPTION",
            planId: testPlanId,
            total: 100000,
          },
        ],
      });
    expect(actPreview.status).toBe(201);
    expect(actPreview.body.applicable).toBe(true);
  });

  it("6. Acceptance: RBAC protection - Reception cannot create/update/deactivate promotions (403)", async () => {
    // Reception cannot create
    const recCreate = await request(server)
      .post("/api/v1/promotions")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "عرض غير مصرح",
        type: "PERCENT",
        value: 10,
      });
    expect(recCreate.status).toBe(403);

    // Reception cannot update
    const recUpdate = await request(server)
      .patch(`/api/v1/promotions/${promoId}`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        name: "تعديل غير مصرح",
      });
    expect(recUpdate.status).toBe(403);

    // Reception cannot deactivate
    const recDeact = await request(server)
      .post(`/api/v1/promotions/${promoId}/deactivate`)
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({});
    expect(recDeact.status).toBe(403);

    // Reception CAN preview in POS
    const recPreview = await request(server)
      .post("/api/v1/promotions/preview")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        code: promoCode,
        memberId: memberBId,
        items: [
          {
            id: "item-7",
            kind: "SUBSCRIPTION",
            planId: testPlanId,
            total: 100000,
          },
        ],
      });
    expect(recPreview.status).toBe(201);
    expect(recPreview.body.applicable).toBe(true);
  });
});
