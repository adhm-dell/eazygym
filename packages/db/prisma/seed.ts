import { PrismaClient, PlanKind, SubscriptionStatus, StaffRole } from "@prisma/client";
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
    },
    {
      id: "staff_gym_admin",
      gymId: "gym_cairo_01",
      name: "منى السيد (أدمن)",
      email: "admin@powercore.gym",
      role: StaffRole.GYM_ADMIN,
      baseSalary: 18000,
      passwordHash: defaultPasswordHash,
    },
    {
      id: "staff_reception",
      gymId: "gym_cairo_01",
      name: "سارة حسن (استقبال)",
      email: "reception@powercore.gym",
      role: StaffRole.RECEPTION,
      baseSalary: 7500,
      passwordHash: defaultPasswordHash,
    },
    {
      id: "staff_cashier",
      gymId: "gym_cairo_01",
      name: "عمر خالد (كاشير البار)",
      email: "bar@powercore.gym",
      role: StaffRole.BAR_CASHIER,
      baseSalary: 6000,
      passwordHash: defaultPasswordHash,
    },
    {
      id: "staff_coach",
      gymId: "gym_cairo_01",
      name: "كابتن أحمد (مدرب لياقة وبرايفت)",
      email: "coach.ahmed@powercore.gym",
      role: StaffRole.COACH,
      baseSalary: 8000,
      passwordHash: defaultPasswordHash,
    },
    {
      id: "staff_coach_tarek",
      gymId: "gym_cairo_01",
      name: "كابتن طارق الديب (كمال أجسام وقوة)",
      email: "coach.tarek@powercore.gym",
      role: StaffRole.COACH,
      baseSalary: 8500,
      passwordHash: defaultPasswordHash,
    },
    {
      id: "staff_coach_mona",
      gymId: "gym_cairo_01",
      name: "كابتن منى زكي (فتنس وتغذية رياضية)",
      email: "coach.mona@powercore.gym",
      role: StaffRole.COACH,
      baseSalary: 7500,
      passwordHash: defaultPasswordHash,
    },
    {
      id: "staff_alex_admin",
      gymId: "gym_alex_02",
      name: "كريم يوسف (أدمن إسكندرية)",
      email: "alex.admin@powercore.gym",
      role: StaffRole.GYM_ADMIN,
      baseSalary: 15000,
      passwordHash: defaultPasswordHash,
    },
  ];

  for (const s of staffData) {
    await prisma.staff.upsert({
      where: { email: s.email },
      update: { passwordHash: s.passwordHash, role: s.role, isActive: true },
      create: s,
    });
  }

  console.log("Seeded staff of all roles");

  // 3. Plans
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
      freezeMaxCount: 2,
      freezeMaxTotalDays: 21,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 20,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_gym_1y",
      gymId: "gym_cairo_01",
      name: "اشتراك جيم سنوي ذهبي (Annual Gold)",
      kind: PlanKind.GYM,
      price: 7500,
      durationDays: 365,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      freezeMaxCount: 4,
      freezeMaxTotalDays: 60,
      minUpfrontPercent: 30,
      dueAfterDays: 30,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
    },
    {
      id: "plan_pt_12",
      gymId: "gym_cairo_01",
      name: "تدريب شخصي 12 جلسة مع كابتن أحمد",
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
      id: "plan_pt_3m",
      gymId: "gym_cairo_01",
      name: "تدريب شخصي 3 أشهر (36 جلسة PT)",
      kind: PlanKind.PT,
      price: 6000,
      durationDays: 90,
      grantsFloorAccess: true,
      totalSessions: 36,
      sessionsPerWeek: 3,
      freezeMaxCount: 2,
      freezeMaxTotalDays: 21,
      minUpfrontPercent: 50,
      dueAfterDays: 30,
      dueAfterPercent: 30,
      commissionable: true,
      commissionMilestones: 3,
      isActive: true,
    },
    {
      id: "plan_gold_01",
      gymId: "gym_cairo_01",
      name: "باقة العضوية الذهبية (Gold VIP)",
      kind: PlanKind.GYM,
      price: 2000,
      durationDays: 60,
      grantsFloorAccess: true,
      totalSessions: null,
      sessionsPerWeek: null,
      maxInvitations: 2,
      freezeMaxCount: 2,
      freezeMaxTotalDays: 14,
      minUpfrontPercent: 50,
      dueAfterDays: 14,
      dueAfterPercent: 25,
      commissionable: false,
      commissionMilestones: 1,
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
        maxInvitations: p.maxInvitations,
        grantsFloorAccess: p.grantsFloorAccess,
        price: p.price,
        durationDays: p.durationDays,
        totalSessions: p.totalSessions,
        minUpfrontPercent: p.minUpfrontPercent,
      },
      create: p,
    });
  }

  console.log("Seeded plans");

  // 4. Members
  const membersData = [
    {
      id: "mem_01",
      gymId: "gym_cairo_01",
      code: "100101",
      name: "أحمد محمد علي",
      phone: "01012345671",
      email: "ahmed.ali@gmail.com",
      gender: "MALE",
      notes: "مشترك نشط - التزام عالي بالتمرين",
      walletBalance: 450,
    },
    {
      id: "mem_mock_main",
      gymId: "gym_cairo_01",
      code: "100245",
      name: "محمد أحمد",
      phone: "01011122233",
      email: "mohamed.ahmed@gmail.com",
      gender: "MALE",
      notes: "عضو رئيسي - موكاب الريسبشن",
      walletBalance: 250,
    },
    {
      id: "mem_02",
      gymId: "gym_cairo_01",
      code: "100202",
      name: "محمود حسن السيد",
      phone: "01012345672",
      email: "mahmoud.h@outlook.com",
      gender: "MALE",
      notes: "ينتهي اشتراكه قريباً",
      walletBalance: 150,
    },
    {
      id: "mem_03",
      gymId: "gym_cairo_01",
      code: "100303",
      name: "سارة إسماعيل فتحي",
      phone: "01123456783",
      gender: "FEMALE",
      notes: "مشتركة موقفة",
      isBlocked: true,
      blockedReason: "سلوك غير لائق وتعدي على مدربة",
      walletBalance: 0,
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
    },
  ];

  for (const m of membersData) {
    const member = await prisma.member.upsert({
      where: {
        gymId_phone: {
          gymId: m.gymId,
          phone: m.phone,
        },
      },
      update: {
        isBlocked: m.isBlocked || false,
        blockedReason: m.blockedReason || null,
        passwordHash: defaultPasswordHash,
      },
      create: {
        id: m.id,
        gymId: m.gymId,
        code: m.code,
        name: m.name,
        phone: m.phone,
        email: m.email || null,
        gender: m.gender || null,
        notes: m.notes || null,
        isBlocked: m.isBlocked || false,
        blockedReason: m.blockedReason || null,
        passwordHash: defaultPasswordHash,
      },
    });

    await prisma.wallet.upsert({
      where: { memberId: member.id },
      update: { balance: m.walletBalance },
      create: {
        gymId: m.gymId,
        memberId: member.id,
        balance: m.walletBalance,
      },
    });
  }

  // 4b. Seed standard Services & Products
  const standardServices = [
    { id: "srv_inbody", gymId: "gym_cairo_01", name: "قياس InBody وتحليل جسم", price: 100, sellableAtPos: true },
    { id: "srv_sauna", gymId: "gym_cairo_01", name: "جلسة ساونا وبخار", price: 150, sellableAtPos: true },
  ];
  for (const s of standardServices) {
    await prisma.service.upsert({
      where: { gymId_name: { gymId: s.gymId, name: s.name } },
      update: { price: s.price, sellableAtPos: s.sellableAtPos },
      create: s,
    });
  }

  const standardProducts = [
    { id: "prod_water", gymId: "gym_cairo_01", name: "مياه معدنية 600 مل", price: 10, stock: 100 },
    { id: "prod_protein_bar", gymId: "gym_cairo_01", name: "بروتين بار شوكولاتة", price: 85, stock: 50 },
  ];
  for (const p of standardProducts) {
    await prisma.product.upsert({
      where: { gymId_name: { gymId: p.gymId, name: p.name } },
      update: { price: p.price, stock: p.stock },
      create: p,
    });
  }

  // 5. Connect Coach Trainee relations for Coach Ahmed
  await prisma.coachTrainee.upsert({
    where: {
      gymId_coachId_memberId: {
        gymId: "gym_cairo_01",
        coachId: "staff_coach",
        memberId: "mem_mock_main",
      },
    },
    update: {},
    create: {
      gymId: "gym_cairo_01",
      coachId: "staff_coach",
      memberId: "mem_mock_main",
    },
  });

  // 6. Open Shifts for Reception and Admin
  await prisma.shift.upsert({
    where: { id: "shift_reception_open" },
    update: { status: "OPEN" },
    create: {
      id: "shift_reception_open",
      gymId: "gym_cairo_01",
      staffId: "staff_reception",
      status: "OPEN",
      openingCash: 1000,
    },
  });

  await prisma.shift.upsert({
    where: { id: "shift_admin_open" },
    update: { status: "OPEN" },
    create: {
      id: "shift_admin_open",
      gymId: "gym_cairo_01",
      staffId: "staff_gym_admin",
      status: "OPEN",
      openingCash: 1000,
    },
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
