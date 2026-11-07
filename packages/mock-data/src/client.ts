import {
  MOCK_GYM,
  MOCK_STAFF,
  MOCK_MEMBERS,
  MOCK_PLANS,
  MOCK_SUBSCRIPTIONS,
  MOCK_INVOICES,
  MOCK_INVOICE_ITEMS,
  MOCK_PAYMENTS,
  MOCK_WALLETS,
  MOCK_CURRENT_SHIFT,
  MOCK_CLASS_SCHEDULES,
  MOCK_CLASS_EXCEPTIONS,
  MOCK_CLASS_SESSIONS,
  MOCK_SUBSCRIPTION_CLASS_SLOTS,
  MOCK_ACCESS_LOGS,
  MOCK_SERVICES,
  MOCK_PRODUCTS,
  MOCK_PROMOTIONS,
  MOCK_VOUCHERS,
  MOCK_EXPENSES,
  MOCK_SHIFTS,
  MOCK_VISITORS,
  MOCK_VISITOR_ATTENDANCES,
  MOCK_SUBSCRIPTION_FREEZES,
  MOCK_COACH_ASSIGNMENTS,
  MOCK_COMMISSION_ENTRIES,
} from "./seed";
import type {
  Gym,
  Staff,
  Member,
  Plan,
  Subscription,
  SubscriptionFreeze,
  CoachAssignment,
  CommissionEntry,
  Visitor,
  VisitorAttendance,
  MemberProfileDetail,
  FreezeSubscriptionDto,
  UnfreezeSubscriptionDto,
  CancelSubscriptionDto,
  ChangeCoachDto,
  LogPtSessionDto,
  CreateVisitorDto,
  CheckInVisitorDto,
  UpdateMemberDto,
  BlockMemberDto,
  Invoice,
  InvoiceItem,
  Payment,
  Wallet,
  Shift,
  AccessLog,
  ClassSchedule,
  ClassSession,
  ClassScheduleWithDetails,
  Service,
  Product,
  Promotion,
  CashVoucher,
  Expense,
  InvoiceDetail,
  CreateInvoiceDto,
  CollectPaymentDto,
  CreateVoucherDto,
  CreateExpenseDto,
  VoidExpenseDto,
  CloseShiftDto,
  AdminCloseAllShiftsDto,
  ShiftReport,
} from "./types";
import {
  evaluateAccess,
  canStartClass,
  evaluatePromotion,
  validateManualDiscount,
  activationDecision,
  balanceDueDate,
  isOverdue,
  planWalletUse,
  settleTender,
  applyWalletDelta,
  allocateAcrossItems,
  allocateProRata,
  addDays,
  expectedCash,
  shiftVariance,
  canCloseShift,
  requireOpenShift,
  canFreeze,
  settleFreeze,
  endDateAfterFreeze,
  splitOnTransfer,
  buildMilestones,
  shiftPendingMilestones,
  canInviteVisitor,
  type AccessDecision,
  type AccessSubscription,
  type ClassSlot,
  type Minor,
  type CartItem,
  type FreezeState,
  type HeldMilestone,
} from "@gym/domain";

export interface ScanResult extends AccessDecision {
  member?: Member | null;
  planName?: string;
  sessionsLeft?: number | null;
}

export class MockApiClient {
  private currentShift: Shift | null = { ...MOCK_CURRENT_SHIFT };
  private shifts: (Shift & { staff?: Staff; closedBy?: Staff | null })[] = [...MOCK_SHIFTS];
  private expenses: Expense[] = [...MOCK_EXPENSES];
  private currentStaffId: string = "staff_reception";
  private classSessions: ClassSession[] = [...MOCK_CLASS_SESSIONS];
  private accessLogs: AccessLog[] = [...MOCK_ACCESS_LOGS];
  private subscriptions: Subscription[] = [...MOCK_SUBSCRIPTIONS];
  private products: Product[] = [...MOCK_PRODUCTS];
  private services: Service[] = [...MOCK_SERVICES];
  private promotions: Promotion[] = [...MOCK_PROMOTIONS];
  private invoices: Invoice[] = [...MOCK_INVOICES];
  private invoiceItems: InvoiceItem[] = [...MOCK_INVOICE_ITEMS];
  private payments: Payment[] = [...MOCK_PAYMENTS];
  private wallets: Wallet[] = [...MOCK_WALLETS];
  private vouchers: CashVoucher[] = [...MOCK_VOUCHERS];
  private members: Member[] = [...MOCK_MEMBERS];
  private freezes: SubscriptionFreeze[] = [...MOCK_SUBSCRIPTION_FREEZES];
  private coachAssignments: CoachAssignment[] = [...MOCK_COACH_ASSIGNMENTS];
  private commissionEntries: CommissionEntry[] = [...MOCK_COMMISSION_ENTRIES];
  private visitors: Visitor[] = [...MOCK_VISITORS];
  private visitorAttendances: VisitorAttendance[] = [...MOCK_VISITOR_ATTENDANCES];
  private nextInvoiceNumber = 1003;

  async getGym(): Promise<Gym> {
    return { ...MOCK_GYM };
  }

  async listStaff(): Promise<Staff[]> {
    return [...MOCK_STAFF];
  }

  async getStaffById(id: string): Promise<Staff | null> {
    const staff = MOCK_STAFF.find((s) => s.id === id);
    return staff ? { ...staff } : null;
  }

  async getCurrentUser(): Promise<Staff> {
    const found = MOCK_STAFF.find((s) => s.id === this.currentStaffId);
    return found ? { ...found } : { ...MOCK_STAFF[2]! };
  }

  async switchActiveUser(staffId: string): Promise<Staff> {
    const found = MOCK_STAFF.find((s) => s.id === staffId);
    if (!found) throw new Error("Staff not found");
    this.currentStaffId = staffId;
    return { ...found };
  }

  buildSubscriptionDetail(sub: Subscription): Subscription {
    const plan = MOCK_PLANS.find((p) => p.id === sub.planId);
    const member = this.members.find((m) => m.id === sub.memberId);
    const assignment = this.coachAssignments.find(
      (ca) => ca.subscriptionId === sub.id && !ca.toDate
    );
    const currentCoach = assignment
      ? MOCK_STAFF.find((s) => s.id === assignment.coachId) ?? null
      : null;
    const subFreezes = this.freezes.filter((f) => f.subscriptionId === sub.id);

    // Calculate collected & remaining
    let collected: Minor = 0;
    const inv = this.invoices.find((i) =>
      i.items?.some((it) => it.planId === sub.planId || it.id === sub.invoiceItemId)
    );
    if (inv) {
      const detail = this.buildInvoiceDetail(inv);
      collected = detail.collectedAmount;
    } else if (sub.status === "ACTIVE" || sub.status === "FROZEN") {
      collected = sub.price;
    } else if (sub.status === "PENDING_PAYMENT") {
      collected = 0;
    } else if (sub.status === "SUSPENDED_UNPAID") {
      collected = Math.round(sub.price * 0.4);
    }
    const remaining: Minor = Math.max(0, sub.price - collected);
    const now = new Date();
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(sub.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const isOverdueSub =
      sub.status === "SUSPENDED_UNPAID" ||
      (remaining > 0 &&
        isOverdue({
          total: sub.price,
          collected,
          startDate: new Date(sub.startDate),
          durationDays: sub.durationDays,
          dueAfterDays: sub.dueAfterDays ?? plan?.dueAfterDays ?? 14,
          dueAfterPercent: sub.dueAfterPercent ?? plan?.dueAfterPercent ?? 25,
          now,
        }));

    return {
      ...sub,
      plan: plan ?? sub.plan,
      member: member ?? sub.member,
      coachAssignment: assignment ?? null,
      currentCoach,
      freezes: subFreezes,
      collected,
      remaining,
      isOverdue: isOverdueSub,
      daysLeft,
      freezeMaxCount: sub.freezeMaxCount ?? plan?.freezeMaxCount ?? 2,
      freezeMaxTotalDays: sub.freezeMaxTotalDays ?? plan?.freezeMaxTotalDays ?? 15,
      freezeUsedCount: sub.freezeUsedCount ?? 0,
      freezeUsedDays: sub.freezeUsedDays ?? 0,
      maxInvitations: sub.maxInvitations ?? 3,
      usedInvitations: sub.usedInvitations ?? 0,
    };
  }

  async listMembers(filters?: {
    query?: string;
    status?: string;
    planKind?: string;
    coachId?: string;
    expiringInDays?: number;
    overdue?: boolean;
    blocked?: boolean;
  }): Promise<Member[]> {
    const q = filters?.query?.trim().toLowerCase();
    const now = new Date();

    let list = this.members.map((m) => {
      const subs = this.subscriptions
        .filter((s) => s.memberId === m.id)
        .map((s) => this.buildSubscriptionDetail(s));
      const activeSub = subs.find(
        (s) => s.status === "ACTIVE" || s.status === "FROZEN" || s.status === "SUSPENDED_UNPAID"
      );
      const wallet = this.wallets.find((w) => w.memberId === m.id);

      const memberInvoices = this.invoices
        .filter((inv) => inv.memberId === m.id && inv.status !== "VOID")
        .map((inv) => this.buildInvoiceDetail(inv));
      const totalRemainingDebt = memberInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);

      const accessSubs: AccessSubscription[] = subs.map((s) => ({
        id: s.id,
        kind: s.kind,
        grantsFloorAccess: s.plan?.grantsFloorAccess ?? true,
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
        cancelled: s.status === "CANCELLED",
        activated: s.status !== "PENDING_PAYMENT",
        frozen: s.status === "FROZEN",
        overdue: s.isOverdue ?? false,
        sessionsLeft: s.sessionsLeft ?? null,
      }));
      const access = evaluateAccess({ isBlocked: m.isBlocked, subscriptions: accessSubs }, now);

      return {
        ...m,
        derivedStatus: access.reason,
        walletBalance: wallet?.balance ?? 0,
        activeSubscriptionsCount: subs.filter((s) => s.status === "ACTIVE").length,
        totalRemainingDebt,
        activePlanName: activeSub?.plan?.name ?? activeSub?.kind,
        daysLeft: activeSub?.daysLeft,
        currentCoachName: activeSub?.currentCoach?.name,
      };
    });

    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.code.includes(q) ||
          m.phone.includes(q) ||
          (m.email && m.email.toLowerCase().includes(q))
      );
    }

    if (filters?.blocked !== undefined) {
      list = list.filter((m) => m.isBlocked === filters.blocked);
    }

    if (filters?.overdue) {
      list = list.filter(
        (m) => (m.totalRemainingDebt ?? 0) > 0 || m.derivedStatus === "PAYMENT_OVERDUE"
      );
    }

    if (filters?.status && filters.status !== "ALL") {
      list = list.filter((m) => m.derivedStatus === filters.status);
    }

    if (filters?.planKind && filters.planKind !== "ALL") {
      list = list.filter((m) => {
        const subs = this.subscriptions.filter((s) => s.memberId === m.id);
        return subs.some((s) => s.kind === filters.planKind);
      });
    }

    if (filters?.coachId && filters.coachId !== "ALL") {
      list = list.filter((m) => {
        const subs = this.subscriptions.filter((s) => s.memberId === m.id);
        return subs.some((s) => {
          const ca = this.coachAssignments.find((a) => a.subscriptionId === s.id && !a.toDate);
          return ca?.coachId === filters.coachId;
        });
      });
    }

    if (filters?.expiringInDays !== undefined) {
      const maxDays = filters.expiringInDays;
      list = list.filter((m) => m.daysLeft !== undefined && m.daysLeft >= 0 && m.daysLeft <= maxDays);
    }

    return list;
  }

  async getMemberById(id: string): Promise<Member | null> {
    const found = this.members.find((m) => m.id === id);
    return found ? { ...found } : null;
  }

  async getMemberByCode(code: string): Promise<Member | null> {
    const cleanCode = code.trim();
    const found = this.members.find((m) => m.code === cleanCode);
    return found ? { ...found } : null;
  }

  async getMemberByPhone(phone: string): Promise<Member | null> {
    const clean = phone.trim();
    const found = this.members.find((m) => m.phone === clean);
    return found ? { ...found } : null;
  }

  async searchMembers(query: string): Promise<Member[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [...this.members];
    return this.members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.includes(q) ||
        m.phone.includes(q) ||
        (m.email && m.email.toLowerCase().includes(q))
    );
  }

  async getMemberProfile(id: string): Promise<MemberProfileDetail> {
    const member = this.members.find((m) => m.id === id);
    if (!member) {
      throw { statusCode: 404, code: "MEMBER_NOT_FOUND", message: "العضو غير موجود" };
    }

    const allSubs = this.subscriptions
      .filter((s) => s.memberId === id)
      .map((s) => this.buildSubscriptionDetail(s));
    const activeSubs = allSubs.filter((s) => s.status === "ACTIVE" || s.status === "FROZEN");
    const wallet = await this.getMemberWallet(id);
    const invoices = await this.getMemberInvoices(id);
    const attendance = this.accessLogs.filter((log) => log.memberId === id);
    const freezeHistory = this.freezes.filter((f) =>
      allSubs.some((s) => s.id === f.subscriptionId)
    );
    const visitorAttendances = this.visitorAttendances
      .filter((va) => va.invitedByMemberId === id)
      .map((va) => ({
        ...va,
        visitor: this.visitors.find((v) => v.id === va.visitorId),
        subscription: allSubs.find((s) => s.id === va.subscriptionId),
      }));

    const totalSpent = invoices
      .filter((inv) => inv.status !== "VOID")
      .reduce((sum, inv) => sum + inv.collectedAmount, 0);
    const totalRemainingDebt = invoices
      .filter((inv) => inv.status !== "VOID")
      .reduce((sum, inv) => sum + inv.remainingAmount, 0);

    const accessSubs: AccessSubscription[] = allSubs.map((s) => ({
      id: s.id,
      kind: s.kind,
      grantsFloorAccess: s.plan?.grantsFloorAccess ?? true,
      startDate: new Date(s.startDate),
      endDate: new Date(s.endDate),
      cancelled: s.status === "CANCELLED",
      activated: s.status !== "PENDING_PAYMENT",
      frozen: s.status === "FROZEN",
      overdue: s.isOverdue ?? false,
      sessionsLeft: s.sessionsLeft ?? null,
    }));
    const access = evaluateAccess({ isBlocked: member.isBlocked, subscriptions: accessSubs }, new Date());

    return {
      ...member,
      walletBalance: wallet.balance,
      activeSubscriptions: activeSubs,
      allSubscriptions: allSubs,
      invoices,
      attendance,
      freezeHistory,
      visitorAttendances,
      totalVisits: attendance.filter((a) => a.allowed).length,
      totalSpent,
      totalRemainingDebt,
      derivedStatus: access.reason,
    };
  }

  async createMember(dto: {
    code?: string;
    name: string;
    phone: string;
    email?: string | null;
    birthDate?: string | null;
    gender?: "MALE" | "FEMALE" | null;
    notes?: string | null;
  }): Promise<Member> {
    const cleanPhone = dto.phone.trim();
    const existing = this.members.find((m) => m.phone === cleanPhone);
    if (existing) {
      throw { statusCode: 409, code: "PHONE_EXISTS", message: "رقم الهاتف مسجل بالفعل لعضو آخر" };
    }

    let code = dto.code?.trim();
    if (!code) {
      let candidate = "";
      do {
        candidate = String(Math.floor(100000 + Math.random() * 900000));
      } while (this.members.some((m) => m.code === candidate));
      code = candidate;
    }

    const newMember: Member = {
      id: `mem_${Date.now()}`,
      gymId: "gym_cairo_01",
      code,
      name: dto.name.trim(),
      phone: cleanPhone,
      email: dto.email?.trim() ?? null,
      birthDate: dto.birthDate ?? null,
      gender: dto.gender ?? null,
      notes: dto.notes?.trim() ?? null,
      isBlocked: false,
      blockedReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.members.unshift(newMember);

    this.wallets.push({
      id: `wallet_${newMember.id}`,
      gymId: newMember.gymId,
      memberId: newMember.id,
      balance: 0,
      updatedAt: new Date().toISOString(),
    });

    return { ...newMember };
  }

  async updateMember(id: string, dto: UpdateMemberDto): Promise<Member> {
    const member = this.members.find((m) => m.id === id);
    if (!member) throw { statusCode: 404, code: "MEMBER_NOT_FOUND", message: "العضو غير موجود" };

    if (dto.phone) {
      const cleanPhone = dto.phone.trim();
      const existing = this.members.find((m) => m.phone === cleanPhone && m.id !== id);
      if (existing) {
        throw { statusCode: 409, code: "PHONE_EXISTS", message: "رقم الهاتف مسجل بالفعل لعضو آخر" };
      }
      member.phone = cleanPhone;
    }

    if (dto.name !== undefined) member.name = dto.name.trim();
    if (dto.email !== undefined) member.email = dto.email ? dto.email.trim() : null;
    if (dto.birthDate !== undefined) member.birthDate = dto.birthDate ?? null;
    if (dto.gender !== undefined) member.gender = dto.gender ?? null;
    if (dto.notes !== undefined) member.notes = dto.notes ? dto.notes.trim() : null;
    member.updatedAt = new Date().toISOString();

    return { ...member };
  }

  async blockMember(id: string, dto: BlockMemberDto): Promise<Member> {
    const member = this.members.find((m) => m.id === id);
    if (!member) throw { statusCode: 404, code: "MEMBER_NOT_FOUND", message: "العضو غير موجود" };
    if (!dto.reason.trim()) {
      throw { statusCode: 400, code: "REASON_REQUIRED", message: "سبب الحظر مطلوب إجبارياً" };
    }
    member.isBlocked = true;
    member.blockedReason = dto.reason.trim();
    member.updatedAt = new Date().toISOString();
    return { ...member };
  }

  async unblockMember(id: string): Promise<Member> {
    const member = this.members.find((m) => m.id === id);
    if (!member) throw { statusCode: 404, code: "MEMBER_NOT_FOUND", message: "العضو غير موجود" };
    member.isBlocked = false;
    member.blockedReason = null;
    member.updatedAt = new Date().toISOString();
    return { ...member };
  }

  async addMemberNote(id: string, note: string): Promise<Member> {
    const member = this.members.find((m) => m.id === id);
    if (!member) throw { statusCode: 404, code: "MEMBER_NOT_FOUND", message: "العضو غير موجود" };
    const dateStr = new Date().toLocaleDateString("ar-EG");
    const newEntry = `[${dateStr}] ${note.trim()}`;
    member.notes = member.notes ? `${member.notes}\n${newEntry}` : newEntry;
    member.updatedAt = new Date().toISOString();
    return { ...member };
  }

  async listPlans(): Promise<Plan[]> {
    return [...MOCK_PLANS];
  }

  async getPlanById(id: string): Promise<Plan | null> {
    const plan = MOCK_PLANS.find((p) => p.id === id);
    return plan ? { ...plan } : null;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return this.subscriptions.map((s) => this.buildSubscriptionDetail(s));
  }

  async getMemberSubscriptions(memberId: string): Promise<Subscription[]> {
    return this.subscriptions
      .filter((s) => s.memberId === memberId)
      .map((s) => this.buildSubscriptionDetail(s));
  }

  async freezeSubscription(
    subscriptionId: string,
    dto?: FreezeSubscriptionDto
  ): Promise<{
    subscription: Subscription;
    freeze: SubscriptionFreeze;
    decision: any;
  }> {
    const sub = this.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw { statusCode: 404, code: "SUBSCRIPTION_NOT_FOUND", message: "الاشتراك غير موجود" };

    const detail = this.buildSubscriptionDetail(sub);
    const isOpenFreeze = this.freezes.some((f) => f.subscriptionId === sub.id && !f.endedAt);

    const freezeState: FreezeState = {
      isFrozen: sub.status === "FROZEN" || isOpenFreeze,
      isActive: sub.status === "ACTIVE",
      overdue: sub.status === "SUSPENDED_UNPAID" || (detail.isOverdue ?? false),
      maxCount: sub.freezeMaxCount ?? 2,
      maxTotalDays: sub.freezeMaxTotalDays ?? 15,
      usedCount: sub.freezeUsedCount ?? 0,
      usedDays: sub.freezeUsedDays ?? 0,
    };

    const decision = canFreeze(freezeState, dto?.days);
    if (!decision.ok) {
      const messages: Record<string, string> = {
        FREEZE_NOT_ALLOWED: "التجميد غير متاح لهذه الباقة",
        ALREADY_FROZEN: "الاشتراك مجمد بالفعل حالياً",
        PAYMENT_OVERDUE: "لا يمكن تجميد الاشتراك لوجود مديونية متأخرة على العضو",
        NOT_ACTIVE: "لا يمكن تجميد اشتراك غير نشط",
        COUNT_EXHAUSTED: "تم استنفاد عدد مرات التجميد المتاحة لهذا الاشتراك",
        DAYS_EXHAUSTED: "تم استنفاد إجمالي أيام التجميد المسموح بها",
        REQUEST_EXCEEDS_REMAINING: `أيام التجميد المطلوبة تتجاوز الرصيد المتبقي (${decision.remainingDays} يوم)`,
      };
      throw {
        statusCode: 400,
        code: decision.reason,
        message: messages[decision.reason ?? ""] || "لا يمكن تجميد الاشتراك",
        decision,
      };
    }

    const currentUser = await this.getCurrentUser();
    const startsAt = dto?.startsAt ? new Date(dto.startsAt) : new Date();
    const plannedEndAt = dto?.days ? addDays(startsAt, dto.days).toISOString() : null;

    const newFreeze: SubscriptionFreeze = {
      id: `freeze_${Date.now()}`,
      subscriptionId: sub.id,
      startedAt: startsAt.toISOString(),
      plannedEndAt,
      endedAt: null,
      days: null,
      reason: dto?.reason?.trim() ?? "طلب تجميد من العضو",
      createdById: currentUser.id,
      createdAt: new Date().toISOString(),
      createdByName: currentUser.name,
    };

    this.freezes.unshift(newFreeze);

    sub.status = "FROZEN";
    sub.freezeUsedCount = (sub.freezeUsedCount ?? 0) + 1;

    return {
      subscription: this.buildSubscriptionDetail(sub),
      freeze: newFreeze,
      decision,
    };
  }

  async unfreezeSubscription(
    subscriptionId: string,
    dto?: UnfreezeSubscriptionDto
  ): Promise<{
    subscription: Subscription;
    freeze: SubscriptionFreeze;
    settledDays: number;
    overflowDays: number;
  }> {
    const sub = this.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw { statusCode: 404, code: "SUBSCRIPTION_NOT_FOUND", message: "الاشتراك غير موجود" };

    const activeFreeze = this.freezes.find(
      (f) => f.subscriptionId === subscriptionId && !f.endedAt
    );
    if (!activeFreeze && sub.status !== "FROZEN") {
      throw { statusCode: 400, code: "NOT_FROZEN", message: "الاشتراك ليس في حالة تجميد" };
    }

    const startedAt = activeFreeze ? new Date(activeFreeze.startedAt) : new Date(sub.startDate);
    const endedAt = dto?.endedAt ? new Date(dto.endedAt) : new Date();
    const remainingDays = Math.max(0, (sub.freezeMaxTotalDays ?? 15) - (sub.freezeUsedDays ?? 0));

    const settlement = settleFreeze({ startedAt, endedAt, remainingDays });

    if (activeFreeze) {
      activeFreeze.endedAt = endedAt.toISOString();
      activeFreeze.days = settlement.days;
    }

    sub.freezeUsedDays = (sub.freezeUsedDays ?? 0) + settlement.days;
    sub.endDate = endDateAfterFreeze(new Date(sub.endDate), settlement.days).toISOString();
    sub.status = "ACTIVE";

    const subComms = this.commissionEntries.filter(
      (c) => c.subscriptionId === sub.id && c.status === "PENDING"
    );
    if (subComms.length > 0) {
      const shifted = shiftPendingMilestones(
        subComms.map((c) => ({
          ...c,
          dueDate: new Date(c.dueDate),
          periodStart: new Date(c.periodStart),
        })),
        endedAt,
        settlement.days
      );
      shifted.forEach((sm) => {
        const found = subComms.find((c) => c.id === sm.id);
        if (found) {
          found.dueDate = sm.dueDate.toISOString();
          found.periodStart = sm.periodStart.toISOString();
        }
      });
    }

    return {
      subscription: this.buildSubscriptionDetail(sub),
      freeze: activeFreeze ?? ({} as SubscriptionFreeze),
      settledDays: settlement.days,
      overflowDays: settlement.overflowDays,
    };
  }

  async cancelSubscription(
    subscriptionId: string,
    dto: CancelSubscriptionDto
  ): Promise<Subscription> {
    const sub = this.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw { statusCode: 404, code: "SUBSCRIPTION_NOT_FOUND", message: "الاشتراك غير موجود" };

    if (!dto.reason.trim()) {
      throw { statusCode: 400, code: "REASON_REQUIRED", message: "سبب الإلغاء مطلوب إجبارياً" };
    }

    sub.status = "CANCELLED";
    sub.cancelledAt = new Date().toISOString();
    sub.cancelledReason = dto.reason.trim();

    this.commissionEntries
      .filter((c) => c.subscriptionId === sub.id && c.status === "PENDING")
      .forEach((c) => {
        c.status = "VOID";
      });

    return this.buildSubscriptionDetail(sub);
  }

  async previewCoachTransfer(
    subscriptionId: string,
    newCoachId: string,
    effectiveAt?: string
  ): Promise<{
    milestones: {
      index: number;
      periodStart: string;
      dueDate: string;
      base: Minor;
      oldCoachShareBps: number;
      newCoachShareBps: number;
      oldCoachPercent: number;
      newCoachPercent: number;
    }[];
  }> {
    const sub = this.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw { statusCode: 404, code: "SUBSCRIPTION_NOT_FOUND", message: "الاشتراك غير موجود" };
    if (sub.kind !== "PT") {
      throw { statusCode: 400, code: "PT_ONLY", message: "تغيير المدرب متاح فقط لاشتراكات التدريب الخاص" };
    }

    const currentCa = this.coachAssignments.find((a) => a.subscriptionId === sub.id && !a.toDate);
    if (currentCa?.coachId === newCoachId) {
      throw { statusCode: 400, code: "INVALID_COACH", message: "المدرب المختار هو نفس المدرب الحالي" };
    }

    const transferDate = effectiveAt ? new Date(effectiveAt) : new Date();
    const msCount = sub.commissionMilestones ?? 3;
    const ms = buildMilestones({
      price: sub.price,
      milestones: msCount,
      startDate: new Date(sub.startDate),
      durationDays: sub.durationDays,
    });

    const heldMilestones: HeldMilestone[] = ms.map((m) => {
      const existing = this.commissionEntries.find(
        (c) => c.subscriptionId === sub.id && c.milestoneIndex === m.index && c.coachId === currentCa?.coachId
      );
      return {
        index: m.index,
        periodStart: m.periodStart,
        dueDate: m.dueDate,
        heldBps: existing?.shareBps ?? 10000,
      };
    });

    const splits = splitOnTransfer(heldMilestones, transferDate);

    return {
      milestones: ms.map((m, i) => {
        const sp = splits[i]!;
        return {
          index: m.index,
          periodStart: m.periodStart.toISOString(),
          dueDate: m.dueDate.toISOString(),
          base: m.base,
          oldCoachShareBps: sp.oldKeepsBps,
          newCoachShareBps: sp.newGetsBps,
          oldCoachPercent: sp.oldKeepsBps / 100,
          newCoachPercent: sp.newGetsBps / 100,
        };
      }),
    };
  }

  async changeCoach(
    subscriptionId: string,
    dto: ChangeCoachDto
  ): Promise<{
    subscription: Subscription;
    splits: any[];
  }> {
    const sub = this.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw { statusCode: 404, code: "SUBSCRIPTION_NOT_FOUND", message: "الاشتراك غير موجود" };
    if (sub.kind !== "PT") {
      throw { statusCode: 400, code: "PT_ONLY", message: "تغيير المدرب متاح لاشتراكات التدريب الخاص فقط" };
    }

    const newCoach = MOCK_STAFF.find((s) => s.id === dto.newCoachId && s.role === "COACH" && s.isActive);
    if (!newCoach) throw { statusCode: 400, code: "INVALID_COACH", message: "المدرب غير صالح أو غير نشط" };

    const currentCa = this.coachAssignments.find((a) => a.subscriptionId === sub.id && !a.toDate);
    if (currentCa?.coachId === dto.newCoachId) {
      throw { statusCode: 400, code: "INVALID_COACH", message: "لا يمكن التحويل لنفس المدرب الحالي" };
    }

    const transferDate = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();

    // 1. Calculate preview splits BEFORE mutating assignments
    const preview = await this.previewCoachTransfer(sub.id, dto.newCoachId, dto.effectiveAt);

    // 2. Close current coach assignment
    if (currentCa) {
      currentCa.toDate = transferDate.toISOString();
    }

    // 3. Open new coach assignment
    this.coachAssignments.unshift({
      id: `ca_${Date.now()}`,
      subscriptionId: sub.id,
      coachId: newCoach.id,
      fromDate: transferDate.toISOString(),
      toDate: null,
      reason: dto.reason?.trim() ?? "تحويل مدرب",
      createdAt: new Date().toISOString(),
      coach: newCoach,
    });

    preview.milestones.forEach((m) => {
      if (currentCa) {
        const oldEntry = this.commissionEntries.find(
          (c) => c.subscriptionId === sub.id && c.milestoneIndex === m.index && c.coachId === currentCa.coachId
        );
        if (oldEntry) {
          oldEntry.shareBps = m.oldCoachShareBps;
        }
      }

      if (m.newCoachShareBps > 0) {
        this.commissionEntries.push({
          id: `comm_${Date.now()}_${m.index}`,
          gymId: sub.gymId,
          subscriptionId: sub.id,
          coachId: newCoach.id,
          milestoneIndex: m.index,
          periodStart: m.periodStart,
          dueDate: m.dueDate,
          baseAmount: m.base,
          shareBps: m.newCoachShareBps,
          allocatedBase: m.base,
          status: "PENDING",
          createdAt: new Date().toISOString(),
          coach: newCoach,
        });
      }
    });

    return {
      subscription: this.buildSubscriptionDetail(sub),
      splits: preview.milestones,
    };
  }

  async logPtSession(
    subscriptionId: string,
    dto?: LogPtSessionDto
  ): Promise<Subscription> {
    const sub = this.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw { statusCode: 404, code: "SUBSCRIPTION_NOT_FOUND", message: "الاشتراك غير موجود" };

    const total = sub.totalSessions ?? 0;
    const used = sub.usedSessions ?? 0;
    if (total > 0 && used >= total) {
      throw { statusCode: 400, code: "NO_SESSIONS_LEFT", message: "تم استنفاد جميع الجلسات المتاحة في هذا الاشتراك" };
    }

    sub.usedSessions = used + 1;
    sub.sessionsLeft = Math.max(0, (sub.sessionsLeft ?? total) - 1);

    return this.buildSubscriptionDetail(sub);
  }

  async listVisitors(query?: string): Promise<Visitor[]> {
    const q = query?.trim().toLowerCase();
    if (!q) return [...this.visitors];
    return this.visitors.filter(
      (v) => v.name.toLowerCase().includes(q) || v.phone.includes(q)
    );
  }

  async createVisitor(dto: CreateVisitorDto): Promise<Visitor> {
    const cleanPhone = dto.phone.trim();
    const existing = this.visitors.find((v) => v.phone === cleanPhone);
    if (existing) {
      throw { statusCode: 409, code: "PHONE_EXISTS", message: "رقم هاتف الزائر مسجل بالفعل" };
    }

    const newVisitor: Visitor = {
      id: `vis_${Date.now()}`,
      gymId: "gym_cairo_01",
      name: dto.name.trim(),
      phone: cleanPhone,
      notes: dto.notes?.trim() ?? null,
      createdAt: new Date().toISOString(),
    };

    this.visitors.unshift(newVisitor);
    return { ...newVisitor };
  }

  async checkInVisitor(dto: CheckInVisitorDto): Promise<{
    success: boolean;
    attendance: VisitorAttendance;
    usedInvitations: number;
    maxInvitations: number;
  }> {
    const member = this.members.find((m) => m.id === dto.invitedByMemberId);
    if (!member) throw { statusCode: 404, code: "MEMBER_NOT_FOUND", message: "العضو الداعي غير موجود" };

    const visitor = this.visitors.find((v) => v.id === dto.visitorId);
    if (!visitor) throw { statusCode: 404, code: "VISITOR_NOT_FOUND", message: "الزائر غير موجود" };

    let sub: Subscription | undefined;
    if (dto.subscriptionId) {
      sub = this.subscriptions.find((s) => s.id === dto.subscriptionId);
    } else {
      sub = this.subscriptions.find((s) => s.memberId === member.id && s.status === "ACTIVE");
    }

    if (!sub) {
      throw { statusCode: 400, code: "SUBSCRIPTION_NOT_USABLE", message: "لا يوجد اشتراك متاح لاستخدام الدعوات" };
    }

    const maxInv = sub.maxInvitations ?? 3;
    const usedInv = sub.usedInvitations ?? 0;
    const usable = sub.status === "ACTIVE";

    const decision = canInviteVisitor({
      subscriptionUsable: usable,
      maxInvitations: maxInv,
      usedInvitations: usedInv,
    });

    if (decision === "SUBSCRIPTION_NOT_USABLE") {
      throw {
        statusCode: 400,
        code: "SUBSCRIPTION_NOT_USABLE",
        message: "اشتراك العضو غير متاح للدعوات (مجمد، متأخر عن السداد، أو منتهي)",
      };
    }
    if (decision === "NO_INVITATIONS_LEFT") {
      throw {
        statusCode: 400,
        code: "NO_INVITATIONS_LEFT",
        message: `تم استنفاد جميع الدعوات المتاحة لهذا الاشتراك (${usedInv} من أصل ${maxInv})`,
      };
    }

    sub.usedInvitations = usedInv + 1;

    const attendance: VisitorAttendance = {
      id: `va_${Date.now()}`,
      gymId: "gym_cairo_01",
      visitorId: visitor.id,
      invitedByMemberId: member.id,
      subscriptionId: sub.id,
      checkInAt: new Date().toISOString(),
      visitor,
      invitedBy: member,
      subscription: this.buildSubscriptionDetail(sub),
    };

    this.visitorAttendances.unshift(attendance);

    return {
      success: true,
      attendance,
      usedInvitations: sub.usedInvitations,
      maxInvitations: maxInv,
    };
  }

  async listOverdueSubscriptions(): Promise<
    (Subscription & {
      member: Member;
      plan: Plan;
      overdueBalance: Minor;
      balanceDueDate: string;
    })[]
  > {
    const overdueList: any[] = [];
    for (const sub of this.subscriptions) {
      const detail = this.buildSubscriptionDetail(sub);
      if (detail.isOverdue || sub.status === "SUSPENDED_UNPAID" || (detail.remaining ?? 0) > 0) {
        if (detail.remaining && detail.remaining > 0 && detail.member && detail.plan) {
          overdueList.push({
            ...detail,
            member: detail.member,
            plan: detail.plan,
            overdueBalance: detail.remaining,
            balanceDueDate: detail.balanceDueDate ?? detail.startDate,
          });
        }
      }
    }
    return overdueList;
  }

  async getMemberInvoices(memberId: string): Promise<InvoiceDetail[]> {
    return this.invoices
      .filter((inv) => inv.memberId === memberId)
      .map((inv) => this.buildInvoiceDetail(inv));
  }

  async listPayments(): Promise<Payment[]> {
    return [...this.payments];
  }

  // Shift Management & Cash Drawer (Shift Gate)
  async getCurrentShift(): Promise<Shift | null> {
    return this.currentShift ? { ...this.currentShift } : null;
  }

  async listShifts(filters?: {
    staffId?: string;
    status?: "OPEN" | "CLOSED";
    hasVariance?: boolean;
  }): Promise<(Shift & { staff?: Staff; closedBy?: Staff | null })[]> {
    let result = [...this.shifts];
    if (filters?.staffId) {
      result = result.filter((s) => s.staffId === filters.staffId);
    }
    if (filters?.status) {
      result = result.filter((s) => s.status === filters.status);
    }
    if (filters?.hasVariance) {
      result = result.filter((s) => s.variance !== null && s.variance !== 0);
    }
    return result.sort(
      (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
    );
  }

  async getShiftById(
    id: string
  ): Promise<(Shift & { staff?: Staff; closedBy?: Staff | null }) | null> {
    const shift =
      this.shifts.find((s) => s.id === id) ||
      (this.currentShift?.id === id ? this.currentShift : null);
    if (!shift) return null;
    return { ...shift };
  }

  async getShiftReport(shiftId: string): Promise<ShiftReport> {
    const shift =
      this.shifts.find((s) => s.id === shiftId) ||
      (this.currentShift?.id === shiftId ? this.currentShift : null);
    if (!shift) throw new Error("Shift not found");

    // All payments for this shift
    const shiftPayments = this.payments.filter((p) => p.shiftId === shiftId);
    const cashPayments = shiftPayments
      .filter((p) => p.method === "CASH")
      .reduce((sum, p) => sum + p.amount, 0);
    const instapayPayments = shiftPayments
      .filter((p) => p.method === "INSTAPAY")
      .reduce((sum, p) => sum + p.amount, 0);
    const cardPayments = shiftPayments
      .filter((p) => p.method === "CARD")
      .reduce((sum, p) => sum + p.amount, 0);
    const walletPayments = shiftPayments
      .filter((p) => p.method === "WALLET")
      .reduce((sum, p) => sum + p.amount, 0);

    // Vouchers for this shift
    const shiftVouchers = this.vouchers.filter((v) => v.shiftId === shiftId);
    const cashReceiptVouchers = shiftVouchers
      .filter((v) => v.type === "RECEIPT" && v.method === "CASH")
      .reduce((sum, v) => sum + v.amount, 0);
    const cashDisbursementVouchers = shiftVouchers
      .filter((v) => v.type === "DISBURSEMENT" && v.method === "CASH")
      .reduce((sum, v) => sum + v.amount, 0);

    // Expenses for this shift
    const shiftExpenses = this.expenses.filter((e) => e.shiftId === shiftId);
    const activeExpenses = shiftExpenses.filter((e) => !e.voidedAt);
    const expensesFromDrawer = activeExpenses
      .filter((e) => e.paidFromDrawer)
      .reduce((sum, e) => sum + e.amount, 0);

    // Expected cash in drawer calculated via domain rule
    const calcExpected = expectedCash({
      openingCash: shift.openingCash,
      cashPayments,
      cashReceiptVouchers,
      expensesFromDrawer,
      cashDisbursementVouchers,
    });

    const expCash = shift.status === "CLOSED" && shift.expectedCash !== null
      ? shift.expectedCash
      : calcExpected;

    // Invoices on this shift
    const shiftInvoices = this.invoices.filter((i) => i.shiftId === shiftId);
    const detailedInvoices: InvoiceDetail[] = [];
    for (const inv of shiftInvoices) {
      const detail = await this.getInvoice(inv.id);
      if (detail) detailedInvoices.push(detail);
    }

    const invoicesTotal = shiftInvoices.reduce((sum, i) => sum + i.total, 0);
    const discountsTotal = shiftInvoices.reduce((sum, i) => sum + i.discount, 0);

    // Sales by kind
    let subscriptionsSales = 0;
    let servicesSales = 0;
    let productsSales = 0;
    for (const inv of detailedInvoices) {
      for (const item of inv.items) {
        if (item.kind === "SUBSCRIPTION") subscriptionsSales += item.total;
        else if (item.kind === "SERVICE") servicesSales += item.total;
        else if (item.kind === "PRODUCT") productsSales += item.total;
      }
    }

    // Wallet credits created (e.g. from receipt vouchers or overpayments)
    const walletCreditsCreated = shiftVouchers
      .filter((v) => v.type === "RECEIPT" && v.walletTxId)
      .reduce((sum, v) => sum + v.amount, 0);

    return {
      shift: { ...shift },
      openingCash: shift.openingCash,
      cashPayments,
      cashReceiptVouchers,
      expensesFromDrawer,
      cashDisbursementVouchers,
      expectedCash: expCash,
      countedCash: shift.countedCash,
      variance: shift.variance,
      instapayPayments,
      cardPayments,
      walletPayments,
      walletCreditsCreated,
      invoicesCount: shiftInvoices.length,
      invoicesTotal,
      discountsTotal,
      salesByKind: {
        subscriptions: subscriptionsSales,
        services: servicesSales,
        products: productsSales,
      },
      records: {
        payments: [...shiftPayments],
        vouchers: [...shiftVouchers],
        expenses: [...shiftExpenses],
        invoices: detailedInvoices,
      },
    };
  }

  async openShift(staffId: string, openingCash: Minor): Promise<Shift> {
    const existingOpen = this.shifts.find(
      (s) => s.staffId === staffId && s.status === "OPEN"
    );
    if (existingOpen) {
      throw new Error("SHIFT_ALREADY_OPEN: لدى هذا الموظف وردية مفتوحة بالفعل");
    }

    const staff = MOCK_STAFF.find((s) => s.id === staffId);
    const newShift: Shift & { staff?: Staff; closedBy?: Staff | null } = {
      id: `shift_${Date.now()}`,
      gymId: MOCK_GYM.id,
      staffId,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      closedAt: null,
      closedById: null,
      openingCash,
      expectedCash: openingCash,
      countedCash: null,
      variance: null,
      note: `وردية مفتوحة - عهدة افتتاحية ${(openingCash / 100).toFixed(2)} ج.م`,
      staff: staff ? { ...staff } : undefined,
    };

    this.shifts.unshift(newShift);
    this.currentShift = { ...newShift };
    return { ...newShift };
  }

  async closeShift(
    shiftId: string,
    countedCash: Minor,
    note?: string,
    actorId?: string,
    actorIsAdmin?: boolean
  ): Promise<Shift> {
    const shift =
      this.shifts.find((s) => s.id === shiftId) ||
      (this.currentShift?.id === shiftId ? this.currentShift : null);
    if (!shift) throw new Error("Shift not found");

    const actor = actorId
      ? MOCK_STAFF.find((s) => s.id === actorId)
      : await this.getCurrentUser();
    const isAdmin =
      actorIsAdmin ?? (actor?.role === "GYM_ADMIN" || actor?.role === "SUPER_ADMIN");
    const aId = actor?.id ?? "staff_reception";

    const denial = canCloseShift({
      shiftStatus: shift.status,
      shiftOwnerId: shift.staffId,
      actorId: aId,
      actorIsAdmin: isAdmin,
    });

    if (denial === "ALREADY_CLOSED") {
      throw new Error("ALREADY_CLOSED: الوردية مغلقة بالفعل ولا يمكن إقفالها مجدداً");
    }
    if (denial === "NOT_OWNER") {
      throw new Error("NOT_OWNER: لا يمكنك إقفال وردية موظف آخر، هذه الصلاحية للمدير فقط");
    }

    const report = await this.getShiftReport(shiftId);
    const expected = report.expectedCash;
    const variance = shiftVariance(expected, countedCash);
    const closedAt = new Date().toISOString();

    shift.status = "CLOSED";
    shift.closedAt = closedAt;
    shift.closedById = aId;
    shift.expectedCash = expected;
    shift.countedCash = countedCash;
    shift.variance = variance;
    if (note) shift.note = note;
    shift.closedBy = actor;

    if (this.currentShift && this.currentShift.id === shiftId) {
      this.currentShift = { ...shift };
    }

    return { ...shift };
  }

  async adminCloseAllShifts(note: string, adminId?: string): Promise<Shift[]> {
    const admin = adminId
      ? MOCK_STAFF.find((s) => s.id === adminId)
      : await this.getCurrentUser();
    const aId = admin?.id ?? "staff_gym_admin";

    const closedList: Shift[] = [];
    const now = new Date().toISOString();

    for (const shift of this.shifts) {
      if (shift.status === "OPEN") {
        const report = await this.getShiftReport(shift.id);
        shift.status = "CLOSED";
        shift.closedAt = now;
        shift.closedById = aId;
        shift.expectedCash = report.expectedCash;
        shift.countedCash = null; // Admin has no physical count
        shift.variance = null;
        shift.note = note || "إقفال جماعي بواسطة الإدارة بدون جرد نقدي";
        shift.closedBy = admin;
        closedList.push({ ...shift });
      }
    }

    if (this.currentShift && this.currentShift.status === "OPEN") {
      const match = this.shifts.find((s) => s.id === this.currentShift!.id);
      if (match) this.currentShift = { ...match };
    }

    return closedList;
  }

  // Expenses Management
  async listExpenses(filters?: {
    shiftId?: string;
    category?: string;
  }): Promise<Expense[]> {
    let result = [...this.expenses];
    if (filters?.shiftId) {
      result = result.filter((e) => e.shiftId === filters.shiftId);
    }
    if (filters?.category) {
      result = result.filter((e) => e.category === filters.category);
    }
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createExpense(
    dto: CreateExpenseDto,
    staffId?: string
  ): Promise<Expense> {
    requireOpenShift(this.currentShift);

    const staff = staffId
      ? MOCK_STAFF.find((s) => s.id === staffId)
      : await this.getCurrentUser();

    const newExpense: Expense = {
      id: `exp_${Date.now()}`,
      gymId: MOCK_GYM.id,
      shiftId: this.currentShift!.id,
      category: dto.category,
      amount: dto.amount,
      description: dto.description || null,
      paidFromDrawer: dto.paidFromDrawer ?? true,
      voidedAt: null,
      voidReason: null,
      createdById: staff?.id ?? "staff_reception",
      createdAt: new Date().toISOString(),
      createdBy: staff
        ? { id: staff.id, name: staff.name }
        : { id: "staff_reception", name: "سارة حسن" },
    };

    this.expenses.unshift(newExpense);

    if (newExpense.paidFromDrawer) {
      this.currentShift!.expectedCash = Math.max(
        0,
        (this.currentShift!.expectedCash ?? this.currentShift!.openingCash) -
          dto.amount
      );
    }

    return { ...newExpense };
  }

  async voidExpense(
    expenseId: string,
    reason: string,
    adminId?: string
  ): Promise<Expense> {
    const exp = this.expenses.find((e) => e.id === expenseId);
    if (!exp) throw new Error("المصروف غير موجود");
    if (exp.voidedAt) throw new Error("المصروف ملغي بالفعل");

    exp.voidedAt = new Date().toISOString();
    exp.voidReason = reason;

    // If shift is still OPEN and was paid from drawer, restore the expectedCash
    if (
      this.currentShift &&
      this.currentShift.id === exp.shiftId &&
      exp.paidFromDrawer
    ) {
      this.currentShift.expectedCash =
        (this.currentShift.expectedCash ?? this.currentShift.openingCash) +
        exp.amount;
    }

    return { ...exp };
  }

  // Access Logs
  async listAccessLogs(): Promise<AccessLog[]> {
    return [...this.accessLogs].sort(
      (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
    );
  }

  async recordAccessLog(entry: Omit<AccessLog, "id" | "scannedAt">): Promise<AccessLog> {
    const newLog: AccessLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      scannedAt: new Date().toISOString(),
      ...entry,
    };
    this.accessLogs.unshift(newLog);
    return newLog;
  }

  // Classes Management
  async listTodayClassSchedules(now: Date = new Date("2026-11-04T10:00:00Z")): Promise<ClassScheduleWithDetails[]> {
    const dayOfWeek = now.getDay();
    const dateStr = now.toISOString().slice(0, 10);

    const todaySchedules = MOCK_CLASS_SCHEDULES.filter((cs) => cs.dayOfWeek === dayOfWeek);

    return todaySchedules.map((cs) => {
      const coach = MOCK_STAFF.find((s) => s.id === cs.coachId);
      const enrolled = MOCK_SUBSCRIPTION_CLASS_SLOTS.filter((slot) => slot.classScheduleId === cs.id);
      const exception = MOCK_CLASS_EXCEPTIONS.find(
        (exc) => exc.classScheduleId === cs.id && exc.date === dateStr
      );
      const isCancelled = exception?.isCancelled ?? false;

      // Find active session
      const session = this.classSessions.find(
        (s) => s.classScheduleId === cs.id && s.date === dateStr
      );

      let status: "NOT_STARTED" | "IN_PROGRESS" | "ENDED" | "CANCELLED" = "NOT_STARTED";
      if (isCancelled) {
        status = "CANCELLED";
      } else if (session) {
        status = session.endedAt ? "ENDED" : "IN_PROGRESS";
      }

      return {
        ...cs,
        coachName: coach ? coach.name : "المدرب",
        enrolledMembersCount: enrolled.length || 14,
        todaySession: session ? { ...session } : null,
        isCancelledToday: isCancelled,
        effectiveStartTime: exception?.newStartTime || cs.startTime,
        effectiveEndTime: exception?.newEndTime || cs.endTime,
        status,
      };
    });
  }

  async startClass(classScheduleId: string, startedById: string, now: Date = new Date("2026-11-04T18:00:00Z")): Promise<ClassSession> {
    const schedule = MOCK_CLASS_SCHEDULES.find((cs) => cs.id === classScheduleId);
    if (!schedule) throw new Error("Class schedule not found");

    const dateStr = now.toISOString().slice(0, 10);
    const exception = MOCK_CLASS_EXCEPTIONS.find(
      (e) => e.classScheduleId === classScheduleId && e.date === dateStr
    );
    const existingSession = this.classSessions.find(
      (s) => s.classScheduleId === classScheduleId && s.date === dateStr
    );

    const denial = canStartClass({
      scheduleDayOfWeek: schedule.dayOfWeek,
      now,
      timeZone: MOCK_GYM.timezone,
      cancelledToday: exception?.isCancelled ?? false,
      alreadyStarted: !!existingSession,
    });

    if (denial !== "OK") {
      throw new Error(`Cannot start class: ${denial}`);
    }

    const newSession: ClassSession = {
      id: `sess_${Date.now()}`,
      gymId: schedule.gymId,
      classScheduleId,
      date: dateStr,
      startedAt: now.toISOString(),
      startedById,
      endedAt: null,
      endedById: null,
      actualCoachId: schedule.coachId,
      note: `بدأ الكلاس في ${now.toLocaleTimeString("ar-EG")}`,
    };

    this.classSessions.push(newSession);
    return { ...newSession };
  }

  async endClass(classSessionId: string, endedById: string, now: Date = new Date("2026-11-04T19:00:00Z")): Promise<ClassSession> {
    const session = this.classSessions.find((s) => s.id === classSessionId || s.classScheduleId === classSessionId);
    if (!session) throw new Error("Class session not found");

    session.endedAt = now.toISOString();
    session.endedById = endedById;
    return { ...session };
  }

  /**
   * Evaluates turnstile/door scan using pure @gym/domain `evaluateAccess`.
   */
  async evaluateDoorScan(code: string, now: Date = new Date("2026-11-04T10:00:00Z")): Promise<ScanResult> {
    // Search member by code or phone or name
    let member = await this.getMemberByCode(code);
    if (!member) {
      member = await this.getMemberByPhone(code);
    }
    if (!member) {
      const results = await this.searchMembers(code);
      if (results.length === 1) {
        member = results[0]!;
      }
    }

    if (!member) {
      return {
        allowed: false,
        reason: "NO_SUBSCRIPTION",
        member: null,
      };
    }

    const memberSubs = await this.getMemberSubscriptions(member.id);
    const dateStr = now.toISOString().slice(0, 10);

    // Map mock subscriptions to domain AccessSubscription shape
    const accessSubs: AccessSubscription[] = memberSubs.map((sub) => {
      const plan = MOCK_PLANS.find((p) => p.id === sub.planId);

      // Resolve class slots if this subscription is a CLASS kind
      let classSlots: ClassSlot[] | undefined;
      if (sub.kind === "CLASS") {
        const enrolledSlots = MOCK_SUBSCRIPTION_CLASS_SLOTS.filter(
          (slot) => slot.subscriptionId === sub.id
        );

        classSlots = enrolledSlots.map((slot) => {
          const schedule = MOCK_CLASS_SCHEDULES.find((cs) => cs.id === slot.classScheduleId)!;
          const exception = MOCK_CLASS_EXCEPTIONS.find(
            (e) => e.classScheduleId === schedule.id && e.date === dateStr
          );
          const session = this.classSessions.find(
            (s) => s.classScheduleId === schedule.id && s.date === dateStr
          );

          const parseMinutes = (timeStr: string) => {
            const [h, m] = timeStr.split(":").map(Number);
            return (h ?? 0) * 60 + (m ?? 0);
          };

          return {
            id: schedule.id,
            dayOfWeek: schedule.dayOfWeek,
            startMinutes: parseMinutes(schedule.startTime),
            endMinutes: parseMinutes(schedule.endTime),
            todayCancelled: exception?.isCancelled,
            todayStartMinutes: exception?.newStartTime ? parseMinutes(exception.newStartTime) : undefined,
            todayEndMinutes: exception?.newEndTime ? parseMinutes(exception.newEndTime) : undefined,
            todayRun: session
              ? {
                  startedAt: new Date(session.startedAt),
                  endedAt: session.endedAt ? new Date(session.endedAt) : null,
                }
              : null,
          };
        });
      }

      // Check for specific test scenarios
      let isOverdue = sub.status === "SUSPENDED_UNPAID";
      if (member?.code === "1006") isOverdue = true;

      const isFrozen = sub.status === "FROZEN" || member?.code === "1007";
      const isCancelled = sub.status === "CANCELLED" || member?.code === "1011";
      const isPending = sub.status === "PENDING_PAYMENT" || member?.code === "1005";

      return {
        id: sub.id,
        kind: sub.kind,
        grantsFloorAccess: plan?.grantsFloorAccess ?? true,
        startDate: new Date(sub.startDate),
        endDate: new Date(sub.endDate),
        cancelled: isCancelled,
        activated: !isPending,
        frozen: isFrozen,
        overdue: isOverdue,
        sessionsLeft: sub.sessionsLeft !== undefined ? sub.sessionsLeft : null,
        classSlots,
      };
    });

    const decision = evaluateAccess(
      {
        isBlocked: member.isBlocked,
        subscriptions: accessSubs,
      },
      now,
      {
        expiringSoonDays: 3,
        timeZone: MOCK_GYM.timezone,
        classEntryMode: member.code === "1018" ? "SCHEDULED" : MOCK_GYM.classEntryMode,
        classEarlyMinutes: MOCK_GYM.classCheckinEarlyMinutes,
      }
    );

    const activeSub = memberSubs.find((s) => s.id === decision.subscriptionId);
    const plan = activeSub ? MOCK_PLANS.find((p) => p.id === activeSub.planId) : null;

    // Record this scan automatically in the access log
    await this.recordAccessLog({
      gymId: MOCK_GYM.id,
      memberId: member.id,
      memberName: member.name,
      subscriptionId: activeSub?.id || null,
      allowed: decision.allowed,
      reason: decision.reason,
      scannedById: "staff_reception",
      planName: plan?.name,
    });

    return {
      ...decision,
      member,
      planName: plan?.name,
      sessionsLeft: activeSub?.sessionsLeft,
    };
  }

  // ---------------------------------------------------------------------------
  // POS, Catalog, Invoices, Payments, Vouchers
  // ---------------------------------------------------------------------------

  async listProducts(): Promise<Product[]> {
    return [...this.products];
  }

  async listServices(): Promise<Service[]> {
    return [...this.services];
  }

  async listPromotions(): Promise<Promotion[]> {
    return [...this.promotions];
  }

  async getMemberWallet(memberId: string): Promise<Wallet> {
    let wallet = this.wallets.find((w) => w.memberId === memberId);
    if (!wallet) {
      wallet = {
        id: "wallet_" + Math.random().toString(36).slice(2, 9),
        gymId: MOCK_GYM.id,
        memberId,
        balance: 0,
        updatedAt: new Date().toISOString(),
      };
      this.wallets.push(wallet);
    }
    return { ...wallet };
  }

  async listInvoices(): Promise<InvoiceDetail[]> {
    return this.invoices.map((inv) => this.buildInvoiceDetail(inv));
  }

  async getInvoice(id: string): Promise<InvoiceDetail | null> {
    const inv = this.invoices.find((i) => i.id === id);
    if (!inv) return null;
    return this.buildInvoiceDetail(inv);
  }

  private buildInvoiceDetail(inv: Invoice): InvoiceDetail {
    const items = this.invoiceItems.filter((i) => i.invoiceId === inv.id);
    const payments = this.payments.filter((p) => p.invoiceId === inv.id);
    const collectedAmount = payments.reduce((s, p) => s + p.amount, 0);
    const remainingAmount = Math.max(0, inv.total - collectedAmount);
    const member = inv.memberId ? MOCK_MEMBERS.find((m) => m.id === inv.memberId) || null : null;
    const staff = MOCK_STAFF.find((s) => s.id === inv.createdById);

    // Overdue check
    let isInvOverdue = false;
    let balanceDue: string | null = null;
    const firstSubItem = items.find((i) => i.kind === "SUBSCRIPTION" && i.planId);
    if (firstSubItem && remainingAmount > 0) {
      const plan = MOCK_PLANS.find((p) => p.id === firstSubItem.planId);
      if (plan) {
        const dueDate = balanceDueDate({
          startDate: new Date(inv.createdAt),
          durationDays: plan.durationDays,
          dueAfterDays: plan.dueAfterDays ?? MOCK_GYM.defaultDueAfterDays,
          dueAfterPercent: plan.dueAfterPercent ?? MOCK_GYM.defaultDueAfterPercent,
        });
        if (dueDate) {
          balanceDue = dueDate.toISOString().slice(0, 10);
          isInvOverdue = new Date("2026-11-04T12:00:00Z").getTime() >= dueDate.getTime();
        }
      }
    }

    return {
      ...inv,
      items,
      payments,
      collectedAmount,
      remainingAmount,
      member,
      isOverdue: isInvOverdue,
      balanceDueDate: balanceDue,
      createdByName: staff?.name,
      pendingApproval: inv.discountApprovedById === null && inv.discount > 0 && (inv.discountNote?.includes("يتطلب موافقة") ?? false),
    };
  }

  async createInvoice(dto: CreateInvoiceDto): Promise<InvoiceDetail> {
    if (!this.currentShift || this.currentShift.status !== "OPEN") {
      throw new Error("NO_OPEN_SHIFT: يجب فتح وردية أولاً لإتمام عمليات البيع");
    }

    if (!dto.items || dto.items.length === 0) {
      throw new Error("EMPTY_CART: لا توجد عناصر في السلة");
    }

    // Check Walk-in restriction
    const hasSubscription = dto.items.some((i) => i.kind === "SUBSCRIPTION");
    if (hasSubscription && !dto.memberId) {
      throw new Error("MEMBER_REQUIRED: يجب تحديد عضو لشراء اشتراك رياضي");
    }

    const nowIso = "2026-11-04T12:00:00.000Z";
    const nowDate = new Date(nowIso);
    const invoiceId = "inv_" + Math.random().toString(36).slice(2, 9);
    const invoiceNumber = this.nextInvoiceNumber++;

    // Prepare items with pricing
    interface PreparedItem {
      id: string;
      kind: "SUBSCRIPTION" | "SERVICE" | "PRODUCT";
      description: string;
      quantity: number;
      unitPrice: Minor;
      total: Minor;
      planId?: string | null;
      serviceId?: string | null;
      productId?: string | null;
      subscription?: any;
    }

    const preparedItems: PreparedItem[] = [];
    for (const item of dto.items) {
      const itemId = "item_" + Math.random().toString(36).slice(2, 9);
      if (item.kind === "SUBSCRIPTION") {
        const plan = MOCK_PLANS.find((p) => p.id === item.planId);
        if (!plan) throw new Error("PLAN_NOT_FOUND: الخطة المحددة غير موجودة");
        const unitPrice = item.unitPrice ?? plan.price;
        preparedItems.push({
          id: itemId,
          kind: "SUBSCRIPTION",
          description: plan.name,
          quantity: item.quantity,
          unitPrice,
          total: unitPrice * item.quantity,
          planId: plan.id,
          subscription: item.subscription,
        });
      } else if (item.kind === "SERVICE") {
        const service = this.services.find((s) => s.id === item.serviceId);
        if (!service) throw new Error("SERVICE_NOT_FOUND: الخدمة المحددة غير موجودة");
        const unitPrice = item.unitPrice ?? service.price;
        preparedItems.push({
          id: itemId,
          kind: "SERVICE",
          description: service.name,
          quantity: item.quantity,
          unitPrice,
          total: unitPrice * item.quantity,
          serviceId: service.id,
        });
      } else if (item.kind === "PRODUCT") {
        const product = this.products.find((p) => p.id === item.productId);
        if (!product) throw new Error("PRODUCT_NOT_FOUND: المنتج المحدد غير موجود");
        if (product.stock < item.quantity) {
          throw new Error("OUT_OF_STOCK: الكمية المطلوبة للمنتج (" + product.name + ") غير متوفرة في المخزن");
        }
        const unitPrice = item.unitPrice ?? product.price;
        preparedItems.push({
          id: itemId,
          kind: "PRODUCT",
          description: product.name,
          quantity: item.quantity,
          unitPrice,
          total: unitPrice * item.quantity,
          productId: product.id,
        });
      }
    }

    const subtotal = preparedItems.reduce((s, i) => s + i.total, 0);
    let discount = 0;
    let appliedPromotionId: string | null = null;
    let discountNote = dto.manualDiscount?.note || null;
    let discountApprovedById: string | null = "staff_reception";
    let pendingApproval = false;

    // Promotions
    if (dto.promotionCode || dto.promotionId) {
      const promo = this.promotions.find(
        (p) =>
          (dto.promotionId && p.id === dto.promotionId) ||
          (dto.promotionCode && p.code?.trim().toLowerCase() === dto.promotionCode.trim().toLowerCase())
      );
      if (!promo) {
        throw new Error("WRONG_CODE: كود الخصم غير موجود أو غير صالح");
      }

      const cartItems: CartItem[] = preparedItems.map((i) => ({
        id: i.id,
        kind: i.kind,
        planId: i.planId,
        total: i.total,
      }));

      const evalResult = evaluatePromotion({
        promo: {
          type: promo.type,
          value: promo.value,
          maxDiscount: promo.maxDiscount,
          minSubtotal: promo.minSubtotal,
          itemKinds: promo.itemKinds,
          planIds: promo.planIds || [],
          startsAt: promo.startsAt ? new Date(promo.startsAt) : null,
          endsAt: promo.endsAt ? new Date(promo.endsAt) : null,
          maxUses: promo.maxUses,
          perMemberLimit: promo.perMemberLimit,
          isActive: promo.isActive,
          code: promo.code,
        },
        items: cartItems,
        now: nowDate,
        enteredCode: dto.promotionCode,
        totalRedemptions: promo.usedCount,
        memberRedemptions: 0,
      });

      if (!evalResult.applicable) {
        throw new Error(`PROMOTION_DENIED:${evalResult.reason || "NOT_APPLICABLE"}`);
      }

      discount = evalResult.discount;
      appliedPromotionId = promo.id;
      promo.usedCount++;

      // Distribute discount pro-rata across eligible items
      for (const itemDisc of evalResult.perItem) {
        const item = preparedItems.find((i) => i.id === itemDisc.id);
        if (item) {
          item.total = Math.max(0, item.total - itemDisc.discount);
        }
      }
    } else if (dto.manualDiscount && dto.manualDiscount.amount > 0) {
      const val = validateManualDiscount({
        subtotal,
        discount: dto.manualDiscount.amount,
        note: dto.manualDiscount.note,
      });
      if (val !== "OK") {
        throw new Error(`MANUAL_DISCOUNT_ERROR:${val}`);
      }
      discount = dto.manualDiscount.amount;

      // Check if exceeds gym limit (e.g. 10%)
      const limitPercent = MOCK_GYM.defaultDueAfterPercent || 10;
      if (discount > (subtotal * limitPercent) / 100) {
        pendingApproval = true;
        discountApprovedById = null;
        discountNote = (discountNote || "") + " (يتطلب موافقة المدير - تجاوز نسبة 10%)";
      }

      // Pro-rata split across all items
      const parts = allocateProRata(
        discount,
        preparedItems.map((i) => i.total)
      );
      preparedItems.forEach((item, idx) => {
        item.total = Math.max(0, item.total - (parts[idx] ?? 0));
      });
    }

    const invoiceTotal = Math.max(0, subtotal - discount);

    // Payments and Wallet settlement
    let wallet = dto.memberId ? this.wallets.find((w) => w.memberId === dto.memberId) : null;
    if (!wallet && dto.memberId) {
      wallet = {
        id: "wallet_" + Math.random().toString(36).slice(2, 9),
        gymId: MOCK_GYM.id,
        memberId: dto.memberId,
        balance: 0,
        updatedAt: nowIso,
      };
      this.wallets.push(wallet);
    }

    const newPayments: Payment[] = [];
    let fromWallet = 0;

    // Auto-use wallet if requested
    if (dto.useWallet !== false && wallet && wallet.balance > 0 && invoiceTotal > 0) {
      const walletPlan = planWalletUse({
        balance: wallet.balance,
        due: invoiceTotal,
        autoApply: true,
      });
      fromWallet = walletPlan.fromWallet;
      if (fromWallet > 0) {
        wallet.balance = applyWalletDelta(wallet.balance, -fromWallet);
        wallet.updatedAt = nowIso;
        newPayments.push({
          id: "pay_" + Math.random().toString(36).slice(2, 9),
          gymId: MOCK_GYM.id,
          invoiceId,
          method: "WALLET",
          amount: fromWallet,
          shiftId: this.currentShift.id,
          receivedById: "staff_reception",
          attributedCoachId: null,
          reference: null,
          note: "خصم تلقائي من محفظة العضو",
          createdAt: nowIso,
        });
      }
    }

    // Other tenders (Cash, Instapay, Card)
    const otherTenders = (dto.payments || []).filter((p) => p.amount > 0);
    const sumOtherTendered = otherTenders.reduce((s, p) => s + p.amount, 0);
    const remainingDueAfterWallet = Math.max(0, invoiceTotal - fromWallet);

    const tenderSettlement = settleTender({
      due: remainingDueAfterWallet,
      tendered: sumOtherTendered,
    });

    // If overpaid, credit excess into member wallet
    if (tenderSettlement.walletCredit > 0 && wallet) {
      wallet.balance = applyWalletDelta(wallet.balance, tenderSettlement.walletCredit);
      wallet.updatedAt = nowIso;
    }

    // Add each tender row
    for (const tender of otherTenders) {
      newPayments.push({
        id: "pay_" + Math.random().toString(36).slice(2, 9),
        gymId: MOCK_GYM.id,
        invoiceId,
        method: tender.method,
        amount: tender.amount,
        shiftId: this.currentShift.id,
        receivedById: "staff_reception",
        attributedCoachId: null,
        reference: tender.reference || null,
        note: tender.method === "CASH" ? "سداد نقدي في الخزينة" : "سداد إلكتروني",
        createdAt: nowIso,
      });

      if (tender.method === "CASH") {
        this.currentShift.expectedCash = (this.currentShift.expectedCash || 0) + tender.amount;
      }
    }

    const collectedTotal = fromWallet + tenderSettlement.applied;
    const remainingAfterAll = Math.max(0, invoiceTotal - collectedTotal);

    // Decrement product inventory
    for (const item of preparedItems) {
      if (item.kind === "PRODUCT" && item.productId) {
        const prod = this.products.find((p) => p.id === item.productId);
        if (prod) {
          prod.stock = Math.max(0, prod.stock - item.quantity);
        }
      }
    }

    // Create subscriptions for SUBSCRIPTION items
    const createdSubscriptions: Subscription[] = [];
    for (const item of preparedItems) {
      if (item.kind === "SUBSCRIPTION" && item.planId && dto.memberId) {
        const plan = MOCK_PLANS.find((p) => p.id === item.planId)!;
        const itemCollected = allocateAcrossItems(collectedTotal, [item.total])[0] ?? 0;
        const minUpfront = plan.minUpfrontPercent ?? MOCK_GYM.defaultMinUpfrontPercent;
        const actDecision = activationDecision({
          total: item.total,
          collected: itemCollected,
          minUpfrontPercent: minUpfront,
        });

        const startDate = item.subscription?.startDate || "2026-11-04";
        const startDt = new Date(startDate);
        const endDt = addDays(startDt, plan.durationDays);
        const subId = "sub_" + Math.random().toString(36).slice(2, 9);

        const sub: Subscription = {
          id: subId,
          gymId: MOCK_GYM.id,
          memberId: dto.memberId,
          planId: plan.id,
          invoiceItemId: item.id,
          bundleId: null,
          kind: plan.kind,
          status: actDecision.canActivate ? "ACTIVE" : "PENDING_PAYMENT",
          price: item.total,
          durationDays: plan.durationDays,
          startDate,
          endDate: endDt.toISOString().slice(0, 10),
          originalEndDate: endDt.toISOString().slice(0, 10),
          activatedAt: actDecision.canActivate ? nowIso : null,
          sessionsLeft: plan.totalSessions,
        };

        this.subscriptions.push(sub);
        createdSubscriptions.push(sub);
      }
    }

    // Create invoice record
    const invoiceRecord: Invoice = {
      id: invoiceId,
      gymId: MOCK_GYM.id,
      number: invoiceNumber,
      memberId: dto.memberId || null,
      status: remainingAfterAll === 0 ? "PAID" : "OPEN",
      subtotal,
      discount,
      promotionId: appliedPromotionId,
      discountNote,
      discountApprovedById,
      total: invoiceTotal,
      note: dto.note || null,
      createdById: "staff_reception",
      shiftId: this.currentShift.id,
      createdAt: nowIso,
      voidedAt: null,
    };

    // Store in state
    this.invoices.push(invoiceRecord);
    for (const item of preparedItems) {
      this.invoiceItems.push({
        id: item.id,
        invoiceId,
        kind: item.kind,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        planId: item.planId,
        serviceId: item.serviceId,
        productId: item.productId,
      });
    }
    for (const p of newPayments) {
      this.payments.push(p);
    }

    return this.buildInvoiceDetail(invoiceRecord);
  }

  async collectInvoicePayment(invoiceId: string, dto: CollectPaymentDto): Promise<InvoiceDetail> {
    if (!this.currentShift || this.currentShift.status !== "OPEN") {
      throw new Error("NO_OPEN_SHIFT: يجب فتح وردية أولاً لتحصيل المدفوعات");
    }

    const inv = this.invoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error("INVOICE_NOT_FOUND: الفاتورة غير موجودة");

    const existingPayments = this.payments.filter((p) => p.invoiceId === invoiceId);
    const previousCollected = existingPayments.reduce((s, p) => s + p.amount, 0);
    const dueRemaining = Math.max(0, inv.total - previousCollected);

    const nowIso = "2026-11-04T12:00:00.000Z";
    const sumTendered = dto.payments.reduce((s, p) => s + p.amount, 0);
    const tenderRes = settleTender({ due: dueRemaining, tendered: sumTendered });

    // Excess to wallet
    if (tenderRes.walletCredit > 0 && inv.memberId) {
      const wallet = await this.getMemberWallet(inv.memberId);
      wallet.balance = applyWalletDelta(wallet.balance, tenderRes.walletCredit);
      wallet.updatedAt = nowIso;
      const wIdx = this.wallets.findIndex((w) => w.id === wallet.id);
      if (wIdx >= 0) this.wallets[wIdx] = wallet;
    }

    // Add payments
    for (const p of dto.payments) {
      const newPay: Payment = {
        id: "pay_" + Math.random().toString(36).slice(2, 9),
        gymId: MOCK_GYM.id,
        invoiceId,
        method: p.method,
        amount: p.amount,
        shiftId: this.currentShift.id,
        receivedById: "staff_reception",
        attributedCoachId: null,
        reference: p.reference || null,
        note: "تحصيل متبقي مستحق",
        createdAt: nowIso,
      };
      this.payments.push(newPay);

      if (p.method === "CASH") {
        this.currentShift.expectedCash = (this.currentShift.expectedCash || 0) + p.amount;
      }
    }

    const newTotalCollected = previousCollected + tenderRes.applied;
    if (newTotalCollected >= inv.total) {
      inv.status = "PAID";
    }

    // Recompute subscriptions associated with this invoice
    const invItems = this.invoiceItems.filter((i) => i.invoiceId === invoiceId);
    for (const item of invItems) {
      if (item.kind === "SUBSCRIPTION" && item.planId && inv.memberId) {
        const sub = this.subscriptions.find((s) => s.invoiceItemId === item.id);
        if (sub) {
          const plan = MOCK_PLANS.find((p) => p.id === item.planId);
          const minUpfront = plan?.minUpfrontPercent ?? MOCK_GYM.defaultMinUpfrontPercent;
          const act = activationDecision({
            total: item.total,
            collected: newTotalCollected,
            minUpfrontPercent: minUpfront,
          });
          if (act.canActivate && (sub.status === "PENDING_PAYMENT" || sub.status === "SUSPENDED_UNPAID")) {
            sub.status = "ACTIVE";
            sub.activatedAt = nowIso;
          }
        }
      }
    }

    return this.buildInvoiceDetail(inv);
  }

  async approveInvoiceDiscount(invoiceId: string): Promise<InvoiceDetail> {
    const inv = this.invoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error("INVOICE_NOT_FOUND");
    inv.discountApprovedById = "staff_gym_admin";
    if (inv.discountNote) {
      inv.discountNote = inv.discountNote.replace("(يتطلب موافقة المدير - تجاوز نسبة 10%)", "(معتمد من إدارة الجيم)");
    }
    return this.buildInvoiceDetail(inv);
  }

  async voidInvoice(invoiceId: string, reason: string): Promise<InvoiceDetail> {
    if (!reason || !reason.trim()) {
      throw new Error("REASON_REQUIRED: سبب الإلغاء مطلوب");
    }
    const inv = this.invoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error("INVOICE_NOT_FOUND");
    if (inv.status === "VOID") throw new Error("ALREADY_VOID: الفاتورة ملغية بالفعل");

    const nowIso = "2026-11-04T12:00:00.000Z";
    inv.status = "VOID";
    inv.voidedAt = nowIso;
    inv.note = (inv.note ? inv.note + " · " : "") + `ملغية: ${reason}`;

    // Reverse cash payments from drawer
    const payments = this.payments.filter((p) => p.invoiceId === invoiceId);
    for (const p of payments) {
      if (p.method === "CASH" && this.currentShift) {
        this.currentShift.expectedCash = Math.max(0, (this.currentShift.expectedCash || 0) - p.amount);
      } else if (p.method === "WALLET" && inv.memberId) {
        // Refund back to wallet
        const wallet = await this.getMemberWallet(inv.memberId);
        wallet.balance += p.amount;
        wallet.updatedAt = nowIso;
        const wIdx = this.wallets.findIndex((w) => w.id === wallet.id);
        if (wIdx >= 0) this.wallets[wIdx] = wallet;
      }
    }

    // Cancel related subscriptions
    const items = this.invoiceItems.filter((i) => i.invoiceId === invoiceId);
    for (const item of items) {
      if (item.kind === "PRODUCT" && item.productId) {
        const prod = this.products.find((p) => p.id === item.productId);
        if (prod) prod.stock += item.quantity;
      } else if (item.kind === "SUBSCRIPTION") {
        const sub = this.subscriptions.find((s) => s.invoiceItemId === item.id);
        if (sub) {
          sub.status = "CANCELLED";
        }
      }
    }

    return this.buildInvoiceDetail(inv);
  }

  async createVoucher(dto: CreateVoucherDto): Promise<CashVoucher> {
    if (!this.currentShift || this.currentShift.status !== "OPEN") {
      throw new Error("NO_OPEN_SHIFT: يجب فتح وردية أولاً لإنشاء سند قبض أو صرف");
    }

    const nowIso = "2026-11-04T12:00:00.000Z";
    const voucher: CashVoucher = {
      id: "vch_" + Math.random().toString(36).slice(2, 9),
      gymId: MOCK_GYM.id,
      type: dto.type,
      memberId: dto.memberId || null,
      method: dto.method,
      amount: dto.amount,
      reason: dto.reason,
      shiftId: this.currentShift.id,
      createdById: "staff_reception",
      createdAt: nowIso,
      walletTxId: null,
    };

    if (dto.type === "RECEIPT") {
      if (dto.method === "CASH") {
        this.currentShift.expectedCash = (this.currentShift.expectedCash || 0) + dto.amount;
      }
      if (dto.creditToWallet && dto.memberId) {
        const wallet = await this.getMemberWallet(dto.memberId);
        wallet.balance = applyWalletDelta(wallet.balance, dto.amount);
        wallet.updatedAt = nowIso;
        const wIdx = this.wallets.findIndex((w) => w.id === wallet.id);
        if (wIdx >= 0) this.wallets[wIdx] = wallet;
        voucher.walletTxId = "wtx_" + Math.random().toString(36).slice(2, 9);
      }
    } else if (dto.type === "DISBURSEMENT") {
      if (dto.method === "CASH") {
        this.currentShift.expectedCash = Math.max(0, (this.currentShift.expectedCash || 0) - dto.amount);
      }
      if (dto.creditToWallet && dto.memberId) {
        const wallet = await this.getMemberWallet(dto.memberId);
        wallet.balance = applyWalletDelta(wallet.balance, -dto.amount);
        wallet.updatedAt = nowIso;
        const wIdx = this.wallets.findIndex((w) => w.id === wallet.id);
        if (wIdx >= 0) this.wallets[wIdx] = wallet;
        voucher.walletTxId = "wtx_" + Math.random().toString(36).slice(2, 9);
      }
    }

    this.vouchers.push(voucher);
    return voucher;
  }
}

export const mockClient = new MockApiClient();
