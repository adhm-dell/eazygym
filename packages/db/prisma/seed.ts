import {
  PrismaClient,
  PlanKind,
  SubscriptionStatus,
  StaffRole,
  PaymentMethod,
  InvoiceStatus,
  InvoiceItemKind,
  CoachSessionType,
  CoachSessionStatus,
  SessionSource,
  ShiftStatus,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding real PostgreSQL database for EazyGym...");

  // 1. Gyms
  const gymCairo = await prisma.gym.upsert({
    where: { id: "gym_cairo_01" },
    update: {},
    create: {
      id: "gym_cairo_01",
      name: "EazyGym - المعادي",
      slug: "eazygym-maadi",
      timezone: "Africa/Cairo",
      currency: "EGP",
      defaultMinUpfrontPercent: 50,
      defaultDueAfterDays: 14,
      defaultDueAfterPercent: 25,
      classEntryMode: "RECEPTION_STARTS",
      classCheckinEarlyMinutes: 15,
      expiryNotifyDays: [7, 3, 1],
      maxCoachBreaksPerDay: 2,
      coachBreakDurationMinutes: 30,
      freeSessionsOnFitnessProfile: 1,
      manualDiscountLimitPercent: 15,
      isActive: true,
    },
  });

  const gymAlex = await prisma.gym.upsert({
    where: { id: "gym_alex_02" },
    update: {},
    create: {
      id: "gym_alex_02",
      name: "EazyGym - سموحة",
      slug: "eazygym-smouha",
      timezone: "Africa/Cairo",
      currency: "EGP",
      defaultMinUpfrontPercent: 50,
      defaultDueAfterDays: 14,
      defaultDueAfterPercent: 25,
      classEntryMode: "RECEPTION_STARTS",
      classCheckinEarlyMinutes: 15,
      expiryNotifyDays: [7, 3, 1],
      maxCoachBreaksPerDay: 2,
      coachBreakDurationMinutes: 30,
      freeSessionsOnFitnessProfile: 1,
      manualDiscountLimitPercent: 10,
      isActive: true,
    },
  });

  console.log("Seeded gyms:", gymCairo.slug, gymAlex.slug);

  // 2. Staff (password: '123456')
  const defaultPasswordHash = await bcrypt.hash("123456", 10);

  const staffData = [
    {
      id: "staff_super_admin",
      gymId: "gym_cairo_01",
      name: "م. طارق العوضي (المالك)",
      email: "owner@powercore.gym",
      role: StaffRole.SUPER_ADMIN,
      baseSalary: 30000,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    {
      id: "staff_gym_admin",
      gymId: "gym_cairo_01",
      name: "منى السيد (أدمن)",
      email: "admin@powercore.gym",
      role: StaffRole.GYM_ADMIN,
      baseSalary: 18000,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    {
      id: "staff_reception",
      gymId: "gym_cairo_01",
      name: "سارة حسن (استقبال)",
      email: "reception@powercore.gym",
      role: StaffRole.RECEPTION,
      baseSalary: 7500,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    {
      id: "staff_cashier",
      gymId: "gym_cairo_01",
      name: "عمر خالد (كاشير البار)",
      email: "bar@powercore.gym",
      role: StaffRole.BAR_CASHIER,
      baseSalary: 6000,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    {
      id: "staff_coach",
      gymId: "gym_cairo_01",
      name: "كابتن أحمد (مدرب لياقة وبرايفت)",
      email: "coach.ahmed@powercore.gym",
      role: StaffRole.COACH,
      baseSalary: 8000,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    {
      id: "staff_coach_tarek",
      gymId: "gym_cairo_01",
      name: "كابتن طارق الديب (كمال أجسام وقوة)",
      email: "coach.tarek@powercore.gym",
      role: StaffRole.COACH,
      baseSalary: 8500,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    {
      id: "staff_coach_mona",
      gymId: "gym_cairo_01",
      name: "كابتن منى زكي (فتنس وتغذية رياضية)",
      email: "coach.mona@powercore.gym",
      role: StaffRole.COACH,
      baseSalary: 7500,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
    {
      id: "staff_alex_admin",
      gymId: "gym_alex_02",
      name: "كريم يوسف (أدمن إسكندرية)",
      email: "alex.admin@powercore.gym",
      role: StaffRole.GYM_ADMIN,
      baseSalary: 12000,
      passwordHash: defaultPasswordHash,
      isActive: true,
    },
  ];

  for (const s of staffData) {
    await prisma.staff.upsert({
      where: { id: s.id },
      update: {
        email: s.email,
        name: s.name,
        role: s.role,
        passwordHash: s.passwordHash,
        isActive: s.isActive,
      },
      create: s,
    });
  }

  console.log("Seeded staff members");

  // 3. Open Shifts
  const openShiftReception = await prisma.shift.upsert({
    where: { id: "shift_reception_open" },
    update: { status: ShiftStatus.OPEN },
    create: {
      id: "shift_reception_open",
      gymId: "gym_cairo_01",
      staffId: "staff_reception",
      status: ShiftStatus.OPEN,
      openingCash: 1000,
    },
  });

  await prisma.shift.upsert({
    where: { id: "shift_admin_open" },
    update: { status: ShiftStatus.OPEN },
    create: {
      id: "shift_admin_open",
      gymId: "gym_cairo_01",
      staffId: "staff_gym_admin",
      status: ShiftStatus.OPEN,
      openingCash: 1500,
    },
  });

  console.log("Seeded open shifts");

  // 4. Plans Catalog
  const plansData = [
    {
      id: "plan_gym_1m",
      gymId: "gym_cairo_01",
      name: "اشتراك جيم شهري (Floor Access)",
      kind: PlanKind.GYM,
      price: 900,
      durationDays: 30,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 1,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 7,
      minUpfrontPercent: 100,
      dueAfterDays: null,
      dueAfterPercent: null,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_gym_3m",
      gymId: "gym_cairo_01",
      name: "اشتراك جيم 90 يوم (Quarterly)",
      kind: PlanKind.GYM,
      price: 2400,
      durationDays: 90,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 3,
      freezeMaxCount: 2,
      freezeMaxTotalDays: 21,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_gym_1y",
      gymId: "gym_cairo_01",
      name: "اشتراك جيم سنوي (Annual)",
      kind: PlanKind.GYM,
      price: 7200,
      durationDays: 365,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 10,
      freezeMaxCount: 4,
      freezeMaxTotalDays: 60,
      minUpfrontPercent: 50,
      dueAfterDays: 30,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_gold_01",
      gymId: "gym_cairo_01",
      name: "اشتراك جولد شامل",
      kind: PlanKind.GYM,
      price: 2000,
      durationDays: 180,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 2,
      freezeMaxCount: 3,
      freezeMaxTotalDays: 30,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_monthly_gym",
      gymId: "gym_cairo_01",
      name: "اشتراك الجيم الشهري (عام)",
      kind: PlanKind.GYM,
      price: 600,
      durationDays: 30,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 1,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 7,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_3m_gym",
      gymId: "gym_cairo_01",
      name: "اشتراك الجيم 3 أشهر (توفير)",
      kind: PlanKind.GYM,
      price: 1500,
      durationDays: 90,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 3,
      freezeMaxCount: 2,
      freezeMaxTotalDays: 15,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_1y_gym",
      gymId: "gym_cairo_01",
      name: "اشتراك الجيم السنوي الذهبي",
      kind: PlanKind.GYM,
      price: 4500,
      durationDays: 365,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 10,
      freezeMaxCount: 4,
      freezeMaxTotalDays: 60,
      minUpfrontPercent: 50,
      dueAfterDays: 30,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_pt_12",
      gymId: "gym_cairo_01",
      name: "تدريب شخصي 12 جلسة PT",
      kind: PlanKind.PT,
      price: 3000,
      durationDays: 45,
      grantsFloorAccess: false,
      totalSessions: 12,
      sessionsPerWeek: 3,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 10,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 30,
      commissionable: true,
      commissionMilestones: 2,
      isActive: true,
    },
    {
      id: "plan_crossfit_1m",
      gymId: "gym_cairo_01",
      name: "اشتراك كلاسات كروس فيت شهري",
      kind: PlanKind.CLASS,
      price: 1200,
      durationDays: 30,
      grantsFloorAccess: true,
      totalSessions: 12,
      sessionsPerWeek: 3,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 7,
      minUpfrontPercent: 100,
      dueAfterDays: null,
      dueAfterPercent: null,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
  ];

  for (const p of plansData) {
    await prisma.plan.upsert({
      where: { id: p.id },
      update: {
        price: p.price,
        durationDays: p.durationDays,
        grantsFloorAccess: p.grantsFloorAccess,
        maxInvitations: p.maxInvitations,
      },
      create: p,
    });
  }

  // 5. Products & Services (POS)
  const productsData = [
    { id: "prod_water", gymId: "gym_cairo_01", name: "مياه معدنية 600 مل", price: 10, stock: 150 },
    { id: "prod_protein_bar", gymId: "gym_cairo_01", name: "بروتين بار شوكولاتة", price: 85, stock: 45 },
    { id: "prod_protein_shake", gymId: "gym_cairo_01", name: "بروتين شيك جاهز (فانيلا)", price: 65, stock: 30 },
    { id: "prod_bcaa", gymId: "gym_cairo_01", name: "مشروب أحماض أمينية BCAA", price: 55, stock: 25 },
    { id: "prod_preworkout", gymId: "gym_cairo_01", name: "مشروب طاقة بري ورك آوت", price: 50, stock: 20 },
    { id: "prod_towel", gymId: "gym_cairo_01", name: "فوطة رياضية EazyGym", price: 120, stock: 15 },
  ];
  for (const prod of productsData) {
    await prisma.product.upsert({
      where: { gymId_name: { gymId: prod.gymId, name: prod.name } },
      update: { price: prod.price, stock: prod.stock },
      create: prod,
    });
  }

  const servicesData = [
    { id: "srv_inbody", gymId: "gym_cairo_01", name: "قياس InBody وتحليل جسم", price: 100, sellableAtPos: true },
    { id: "srv_sauna", gymId: "gym_cairo_01", name: "جلسة ساونا وبخار", price: 150, sellableAtPos: true },
  ];
  for (const s of servicesData) {
    await prisma.service.upsert({
      where: { gymId_name: { gymId: s.gymId, name: s.name } },
      update: { price: s.price, sellableAtPos: s.sellableAtPos },
      create: s,
    });
  }

  // 6. Members with Full Realistic Data
  const now = new Date();
  const dayMs = 24 * 3600 * 1000;

  const membersToSeed = [
    {
      id: "mem_mock_main",
      code: "100245",
      name: "محمد أحمد",
      phone: "01011122233",
      email: "mohamed.ahmed@gmail.com",
      gender: "MALE",
      walletBalance: 250,
      notes: "عضو رئيسي - نشط وملتزم مع الكابتن",
      isBlocked: false,
    },
    {
      id: "mem_01",
      code: "100101",
      name: "أحمد محمد علي",
      phone: "01012345671",
      email: "ahmed.ali@gmail.com",
      gender: "MALE",
      walletBalance: 450,
      notes: "مشترك نشط - التزام عالي بالتمرين",
      isBlocked: false,
    },
    {
      id: "mem_02",
      code: "100202",
      name: "محمود حسن السيد",
      phone: "01012345672",
      email: "mahmoud.h@outlook.com",
      gender: "MALE",
      walletBalance: 150,
      notes: "ينتهي اشتراكه قريباً (3 أيام)",
      isBlocked: false,
    },
    {
      id: "mem_04",
      code: "100404",
      name: "زياد محمود الشناوي",
      phone: "01012345674",
      gender: "MALE",
      walletBalance: 50,
      notes: "اشتراك مجمد لسفر عمل",
      isBlocked: false,
    },
    {
      id: "mem_05",
      code: "100505",
      name: "كريم عادل فهمي",
      phone: "01012345675",
      gender: "MALE",
      walletBalance: 0,
      notes: "عليه قسط متأخر 500 ج.م",
      isBlocked: false,
    },
    {
      id: "mem_03",
      code: "100303",
      name: "سارة إسماعيل فتحي",
      phone: "01123456783",
      gender: "FEMALE",
      walletBalance: 0,
      notes: "مشتركة موقفة",
      isBlocked: true,
      blockedReason: "سلوك غير لائق وتعدي على مدربة",
    },
    {
      id: "mem_06",
      code: "100606",
      name: "خالد مصطفى إبراهيم",
      phone: "01012345676",
      gender: "MALE",
      walletBalance: 0,
      notes: "اشتراك منتهي منذ 10 أيام",
      isBlocked: false,
    },
    {
      id: "mem_alex_01",
      gymId: "gym_alex_02",
      code: "200101",
      name: "طارق الإسكندراني",
      phone: "01233445566",
      email: "tarek.alex@gmail.com",
      gender: "MALE",
      notes: "عضو في فرع الإسكندرية (لاختبار العزل)",
      walletBalance: 100,
      isBlocked: false,
    },
  ];

  for (const m of membersToSeed) {
    const memberGymId = (m as any).gymId || "gym_cairo_01";
    const member = await prisma.member.upsert({
      where: {
        gymId_phone: {
          gymId: memberGymId,
          phone: m.phone,
        },
      },
      update: {
        code: m.code,
        name: m.name,
        isBlocked: m.isBlocked,
        blockedReason: (m as any).blockedReason || null,
        notes: m.notes,
      },
      create: {
        id: m.id,
        gymId: memberGymId,
        code: m.code,
        name: m.name,
        phone: m.phone,
        email: (m as any).email || null,
        gender: (m as any).gender || null,
        notes: m.notes || null,
        isBlocked: m.isBlocked,
        blockedReason: (m as any).blockedReason || null,
        passwordHash: defaultPasswordHash,
      },
    });

    await prisma.wallet.upsert({
      where: { memberId: member.id },
      update: { balance: m.walletBalance },
      create: {
        gymId: memberGymId,
        memberId: member.id,
        balance: m.walletBalance,
      },
    });
  }

  console.log("Seeded members and wallets");

  // 7. Subscriptions & Invoices for Members
  // Member 100245 (Mohamed Ahmed): ACTIVE 3-Month Gym (ends in 21 days) + ACTIVE PT 12 (6 sessions left)
  const memMainGymEnd = new Date(now.getTime() + 21 * dayMs);
  const memMainGymStart = new Date(memMainGymEnd.getTime() - 90 * dayMs);

  const subMainGym = await prisma.subscription.upsert({
    where: { id: "sub_mem_main_gym" },
    update: {
      status: SubscriptionStatus.ACTIVE,
      startDate: memMainGymStart,
      endDate: memMainGymEnd,
      originalEndDate: memMainGymEnd,
    },
    create: {
      id: "sub_mem_main_gym",
      gymId: "gym_cairo_01",
      memberId: "mem_mock_main",
      planId: "plan_3m_gym",
      kind: PlanKind.GYM,
      status: SubscriptionStatus.ACTIVE,
      price: 1500,
      durationDays: 90,
      startDate: memMainGymStart,
      endDate: memMainGymEnd,
      originalEndDate: memMainGymEnd,
      freezeMaxCount: 2,
      freezeMaxTotalDays: 15,
      minUpfrontPercent: 50,
      createdById: "staff_reception",
    },
  });

  const memMainPtEnd = new Date(now.getTime() + 25 * dayMs);
  const memMainPtStart = new Date(memMainPtEnd.getTime() - 45 * dayMs);

  const subMainPt = await prisma.subscription.upsert({
    where: { id: "sub_mem_main_pt" },
    update: {
      status: SubscriptionStatus.ACTIVE,
      totalSessions: 12,
      usedSessions: 6,
      startDate: memMainPtStart,
      endDate: memMainPtEnd,
      originalEndDate: memMainPtEnd,
    },
    create: {
      id: "sub_mem_main_pt",
      gymId: "gym_cairo_01",
      memberId: "mem_mock_main",
      planId: "plan_pt_12",
      kind: PlanKind.PT,
      status: SubscriptionStatus.ACTIVE,
      price: 3000,
      durationDays: 45,
      totalSessions: 12,
      usedSessions: 6,
      startDate: memMainPtStart,
      endDate: memMainPtEnd,
      originalEndDate: memMainPtEnd,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 10,
      minUpfrontPercent: 50,
      createdById: "staff_reception",
    },
  });

  await prisma.coachAssignment.upsert({
    where: { id: "assign_mem_main_pt" },
    update: { toDate: null },
    create: {
      id: "assign_mem_main_pt",
      subscriptionId: subMainPt.id,
      coachId: "staff_coach",
      fromDate: memMainPtStart,
    },
  });

  // Member 100101 (Ahmed Mohamed Ali): ACTIVE 1-Month Gym (ends in 15 days)
  const mem01End = new Date(now.getTime() + 15 * dayMs);
  const mem01Start = new Date(mem01End.getTime() - 30 * dayMs);
  await prisma.subscription.upsert({
    where: { id: "sub_mem_01_gym" },
    update: {
      status: SubscriptionStatus.ACTIVE,
      startDate: mem01Start,
      endDate: mem01End,
      originalEndDate: mem01End,
    },
    create: {
      id: "sub_mem_01_gym",
      gymId: "gym_cairo_01",
      memberId: "mem_01",
      planId: "plan_monthly_gym",
      kind: PlanKind.GYM,
      status: SubscriptionStatus.ACTIVE,
      price: 600,
      durationDays: 30,
      startDate: mem01Start,
      endDate: mem01End,
      originalEndDate: mem01End,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 7,
      minUpfrontPercent: 50,
      createdById: "staff_reception",
    },
  });

  // Member 100202 (Mahmoud Hassan): ACTIVE Gym, Expiring in 3 Days!
  const mem02End = new Date(now.getTime() + 3 * dayMs);
  const mem02Start = new Date(mem02End.getTime() - 30 * dayMs);
  await prisma.subscription.upsert({
    where: { id: "sub_mem_02_gym" },
    update: {
      status: SubscriptionStatus.ACTIVE,
      startDate: mem02Start,
      endDate: mem02End,
      originalEndDate: mem02End,
    },
    create: {
      id: "sub_mem_02_gym",
      gymId: "gym_cairo_01",
      memberId: "mem_02",
      planId: "plan_monthly_gym",
      kind: PlanKind.GYM,
      status: SubscriptionStatus.ACTIVE,
      price: 600,
      durationDays: 30,
      startDate: mem02Start,
      endDate: mem02End,
      originalEndDate: mem02End,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 7,
      minUpfrontPercent: 50,
      createdById: "staff_reception",
    },
  });

  // Member 100404 (Ziad): FROZEN
  const mem04End = new Date(now.getTime() + 60 * dayMs);
  const mem04Start = new Date(now.getTime() - 30 * dayMs);
  const subFrozen = await prisma.subscription.upsert({
    where: { id: "sub_mem_04_frozen" },
    update: {
      status: SubscriptionStatus.FROZEN,
      freezeUsedCount: 1,
      freezeUsedDays: 14,
    },
    create: {
      id: "sub_mem_04_frozen",
      gymId: "gym_cairo_01",
      memberId: "mem_04",
      planId: "plan_3m_gym",
      kind: PlanKind.GYM,
      status: SubscriptionStatus.FROZEN,
      price: 1500,
      durationDays: 90,
      startDate: mem04Start,
      endDate: mem04End,
      originalEndDate: mem04End,
      freezeMaxCount: 2,
      freezeMaxTotalDays: 15,
      freezeUsedCount: 1,
      freezeUsedDays: 14,
      minUpfrontPercent: 50,
      createdById: "staff_reception",
    },
  });

  await prisma.subscriptionFreeze.upsert({
    where: { id: "freeze_mem_04" },
    update: {},
    create: {
      id: "freeze_mem_04",
      subscriptionId: subFrozen.id,
      startedAt: new Date(now.getTime() - 4 * dayMs),
      plannedEndAt: new Date(now.getTime() + 10 * dayMs),
      reason: "سفر عمل لمدة أسبوعين",
      createdById: "staff_reception",
    },
  });

  // Member 100505 (Karim): SUSPENDED_UNPAID (Overdue installment)
  const mem05End = new Date(now.getTime() + 70 * dayMs);
  const mem05Start = new Date(now.getTime() - 20 * dayMs);
  await prisma.subscription.upsert({
    where: { id: "sub_mem_05_unpaid" },
    update: { status: SubscriptionStatus.SUSPENDED_UNPAID },
    create: {
      id: "sub_mem_05_unpaid",
      gymId: "gym_cairo_01",
      memberId: "mem_05",
      planId: "plan_3m_gym",
      kind: PlanKind.GYM,
      status: SubscriptionStatus.SUSPENDED_UNPAID,
      price: 1500,
      durationDays: 90,
      startDate: mem05Start,
      endDate: mem05End,
      originalEndDate: mem05End,
      freezeMaxCount: 2,
      freezeMaxTotalDays: 15,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 25,
      createdById: "staff_reception",
    },
  });

  // Member 100606 (Khaled): EXPIRED
  const mem06End = new Date(now.getTime() - 10 * dayMs);
  const mem06Start = new Date(now.getTime() - 40 * dayMs);
  await prisma.subscription.upsert({
    where: { id: "sub_mem_06_expired" },
    update: { status: SubscriptionStatus.EXPIRED },
    create: {
      id: "sub_mem_06_expired",
      gymId: "gym_cairo_01",
      memberId: "mem_06",
      planId: "plan_monthly_gym",
      kind: PlanKind.GYM,
      status: SubscriptionStatus.EXPIRED,
      price: 600,
      durationDays: 30,
      startDate: mem06Start,
      endDate: mem06End,
      originalEndDate: mem06End,
      freezeMaxCount: 1,
      freezeMaxTotalDays: 7,
      minUpfrontPercent: 50,
      createdById: "staff_reception",
    },
  });

  console.log("Seeded member subscriptions with realistic lifecycle statuses");

  // 8. Fitness Profile & InBody for Member 100245
  const fp = await prisma.fitnessProfile.upsert({
    where: { memberId: "mem_mock_main" },
    update: {
      goals: "خسارة دهون وبناء كتلة عضلية",
      medicalConditions: "سليم - لا توجد إصابات",
    },
    create: {
      id: "fp_mem_main",
      gymId: "gym_cairo_01",
      memberId: "mem_mock_main",
      goals: "خسارة دهون وبناء كتلة عضلية",
      medicalConditions: "سليم - لا توجد إصابات",
      notes: "تم إهداء حصة تجريبية مجانية مع الكابتن",
    },
  });

  await prisma.fitnessProfileAssignment.deleteMany({
    where: { profileId: fp.id },
  });

  await prisma.fitnessProfileAssignment.create({
    data: {
      id: "fpa_mem_main",
      gymId: "gym_cairo_01",
      profileId: fp.id,
      coachId: "staff_coach",
      source: "MANUAL",
      status: "ACCEPTED",
      respondedAt: now,
    },
  });

  await prisma.fitnessAssessment.deleteMany({
    where: { memberId: "mem_mock_main" },
  });

  await prisma.fitnessAssessment.create({
    data: {
      id: "inbody_mem_main_1",
      gymId: "gym_cairo_01",
      memberId: "mem_mock_main",
      metrics: {
        weight: 78.5,
        bodyFatPercent: 18.2,
        muscleMass: 38.4,
        waterPercent: 58,
        visceralFatLevel: 5,
        bmr: 1720,
        notes: "تحسن ملحوظ في نسبة الدهون وزيادة الكتلة العضلية",
      },
      assessmentDate: new Date(now.getTime() - 2 * dayMs),
      createdById: "staff_coach",
    },
  });

  // 9. Coach Shifts & Active Shift
  const todayDow = now.getDay(); // 0-6
  await prisma.coachShift.deleteMany({
    where: { gymId: "gym_cairo_01" },
  });

  // Give Coach Ahmed and Coach Tarek a shift today covering current time!
  await prisma.coachShift.createMany({
    data: [
      {
        id: "shift_ahmed_today",
        gymId: "gym_cairo_01",
        coachId: "staff_coach",
        dayOfWeek: todayDow,
        startTime: "06:00",
        endTime: "23:59",
        isActive: true,
      },
      {
        id: "shift_tarek_today",
        gymId: "gym_cairo_01",
        coachId: "staff_coach_tarek",
        dayOfWeek: todayDow,
        startTime: "08:00",
        endTime: "20:00",
        isActive: true,
      },
      {
        id: "shift_mona_tomorrow",
        gymId: "gym_cairo_01",
        coachId: "staff_coach_mona",
        dayOfWeek: (todayDow + 1) % 7,
        startTime: "12:00",
        endTime: "20:00",
        isActive: true,
      },
    ],
  });

  // 10. Coach Rotation Queue
  await prisma.coachRotationQueue.deleteMany({
    where: { gymId: "gym_cairo_01" },
  });

  await prisma.coachRotationQueue.createMany({
    data: [
      { id: "rot_1", gymId: "gym_cairo_01", coachId: "staff_coach", position: 1 },
      { id: "rot_2", gymId: "gym_cairo_01", coachId: "staff_coach_tarek", position: 2 },
      { id: "rot_3", gymId: "gym_cairo_01", coachId: "staff_coach_mona", position: 3 },
    ],
  });

  // 11. Coach Sessions for Today
  await prisma.coachSession.deleteMany({
    where: { gymId: "gym_cairo_01" },
  });

  const session1Start = new Date(now.getTime() + 2 * 3600 * 1000);
  const session1End = new Date(session1Start.getTime() + 60 * 60 * 1000);

  const session1 = await prisma.coachSession.create({
    data: {
      id: "cs_today_01",
      gymId: "gym_cairo_01",
      coachId: "staff_coach",
      type: CoachSessionType.PRIVATE,
      status: CoachSessionStatus.SCHEDULED,
      startTime: session1Start,
      endTime: session1End,
      notes: "جلسة قوة وتمارين أرجل - محمد أحمد",
    },
  });

  await prisma.sessionParticipant.create({
    data: {
      id: "sp_today_01",
      sessionId: session1.id,
      memberId: "mem_mock_main",
      source: SessionSource.PT_LINKED,
      subscriptionId: subMainPt.id,
      attended: false,
    },
  });

  // 12. Expenses for Today's Shift
  await prisma.expense.deleteMany({
    where: { gymId: "gym_cairo_01" },
  });

  await prisma.expense.createMany({
    data: [
      {
        id: "exp_today_01",
        gymId: "gym_cairo_01",
        shiftId: openShiftReception.id,
        category: "نظافة وأدوات",
        amount: 250,
        description: "شراء منظفات ومعقمات للصالات",
        paidFromDrawer: true,
        createdById: "staff_reception",
        createdAt: new Date(now.getTime() - 3 * 3600 * 1000),
      },
      {
        id: "exp_today_02",
        gymId: "gym_cairo_01",
        shiftId: openShiftReception.id,
        category: "صيانة",
        amount: 400,
        description: "صيانة سير المشي Treadmill رقم 2",
        paidFromDrawer: true,
        createdById: "staff_reception",
        createdAt: new Date(now.getTime() - 1 * 3600 * 1000),
      },
      {
        id: "exp_today_03",
        gymId: "gym_cairo_01",
        shiftId: openShiftReception.id,
        category: "ضيافة وبوفيه",
        amount: 120,
        description: "شاي وقهوة وسكر للاستقبال",
        paidFromDrawer: true,
        createdById: "staff_reception",
        createdAt: now,
      },
    ],
  });

  // 13. Visitors
  await prisma.visitor.upsert({
    where: {
      gymId_phone: {
        gymId: "gym_cairo_01",
        phone: "01099887766",
      },
    },
    update: {},
    create: {
      id: "vis_01",
      gymId: "gym_cairo_01",
      name: "ياسر إبراهيم السيد",
      phone: "01099887766",
      notes: "دعوة تجريبية من الصديق محمد أحمد",
    },
  });

  console.log("Database seeded successfully with complete live test data!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
