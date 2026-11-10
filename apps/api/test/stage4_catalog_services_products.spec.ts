import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Stage 4: Services and Bar Products Management Acceptance Tests", () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  let adminToken = "";
  let receptionToken = "";
  let gymId = "";

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Acceptance: A new service created appears immediately in POS active list; duplicate name returns 409", async () => {
    const serviceName = `مساج علاجي ${Date.now()}`;

    // 1. Create service (price in piasters: 250 EGP = 25,000 piasters)
    const createRes = await request(server)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: serviceName,
        price: 25000,
        sellableAtPos: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe(serviceName);
    expect(createRes.body.price).toBe(25000);
    expect(createRes.body.sellableAtPos).toBe(true);
    expect(createRes.body.isActive).toBe(true);
    const serviceId = createRes.body.id;

    // 2. Duplicate service name -> 409 Conflict with SERVICE_EXISTS
    const dupRes = await request(server)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: serviceName,
        price: 30000,
        sellableAtPos: true,
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe("SERVICE_EXISTS");

    // 3. POS query (/services?active=true) includes the new service
    const posActiveRes = await request(server)
      .get("/api/v1/services?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    expect(posActiveRes.status).toBe(200);
    const found = posActiveRes.body.find((s: any) => s.id === serviceId);
    expect(found).toBeDefined();
    expect(found.isActive).toBe(true);
  });

  it("2. Acceptance: Deactivating a service immediately removes it from the POS Services tab", async () => {
    const serviceName = `ساونا مؤقتة ${Date.now()}`;
    const createRes = await request(server)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: serviceName,
        price: 15000,
        sellableAtPos: true,
      });
    const serviceId = createRes.body.id;

    // Deactivate service
    const patchRes = await request(server)
      .patch(`/api/v1/services/${serviceId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.isActive).toBe(false);

    // POS query (/services?active=true) no longer returns it
    const posRes = await request(server)
      .get("/api/v1/services?active=true")
      .set("Authorization", `Bearer ${receptionToken}`);
    const found = posRes.body.find((s: any) => s.id === serviceId);
    expect(found).toBeUndefined();

    // Full catalog query (/services) still lists it
    const allRes = await request(server)
      .get("/api/v1/services")
      .set("Authorization", `Bearer ${adminToken}`);
    const foundInAll = allRes.body.find((s: any) => s.id === serviceId);
    expect(foundInAll).toBeDefined();
    expect(foundInAll.isActive).toBe(false);
  });

  it("3. Acceptance: Selling the last unit of a product reduces stock to 0 and POS refuses further sales with OUT_OF_STOCK", async () => {
    const productName = `بروتين شيك فراولة ${Date.now()}`;

    // 1. Create product with initial stock = 1 unit
    const createRes = await request(server)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: productName,
        price: 8500, // 85 EGP
        stock: 1,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.stock).toBe(1);
    const productId = createRes.body.id;

    // 2. Duplicate product name -> 409 Conflict with PRODUCT_EXISTS
    const dupRes = await request(server)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: productName,
        price: 9000,
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe("PRODUCT_EXISTS");

    // 3. Sell the 1 unit via POS invoice (walk-in allowed for bar products)
    const sale1 = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        items: [
          {
            kind: "PRODUCT",
            productId,
            quantity: 1,
          },
        ],
        payments: [
          {
            method: "CASH",
            amount: 8500,
          },
        ],
        useWallet: false,
      });
    expect(sale1.status).toBe(201);

    // 4. Verify stock in database is now 0
    const checkProduct = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(checkProduct?.stock).toBe(0);

    // 5. Attempting to sell another unit when stock is 0 -> 422 OUT_OF_STOCK
    const sale2 = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        items: [
          {
            kind: "PRODUCT",
            productId,
            quantity: 1,
          },
        ],
        payments: [
          {
            method: "CASH",
            amount: 8500,
          },
        ],
        useWallet: false,
      });
    expect(sale2.status).toBe(422);
    expect(sale2.body.code).toBe("OUT_OF_STOCK");

    // 6. Adjust stock (add 10 units via PATCH)
    const adjustRes = await request(server)
      .patch(`/api/v1/products/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ stock: 10 });
    expect(adjustRes.status).toBe(200);
    expect(adjustRes.body.stock).toBe(10);

    // 7. Selling now succeeds
    const sale3 = await request(server)
      .post("/api/v1/invoices")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({
        items: [
          {
            kind: "PRODUCT",
            productId,
            quantity: 2,
          },
        ],
        payments: [
          {
            method: "CASH",
            amount: 17000,
          },
        ],
        useWallet: false,
      });
    expect(sale3.status).toBe(201);

    const checkProductAfter = await prisma.product.findUnique({
      where: { id: productId },
    });
    expect(checkProductAfter?.stock).toBe(8);
  });

  it("4. Acceptance: RBAC guard - Reception cannot create or update services or products, Admin can", async () => {
    // Reception cannot create service
    const recCreateSrv = await request(server)
      .post("/api/v1/services")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "خدمة غير مصرحة", price: 10000 });
    expect(recCreateSrv.status).toBe(403);

    // Reception cannot create product
    const recCreateProd = await request(server)
      .post("/api/v1/products")
      .set("Authorization", `Bearer ${receptionToken}`)
      .send({ name: "منتج غير مصرح", price: 10000, stock: 5 });
    expect(recCreateProd.status).toBe(403);
  });
});
