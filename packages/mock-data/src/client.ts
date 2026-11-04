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
} from "./seed";
import type {
  Gym,
  Staff,
  Member,
  Plan,
  Subscription,
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
  InvoiceDetail,
  CreateInvoiceDto,
  CollectPaymentDto,
  CreateVoucherDto,
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
  type AccessDecision,
  type AccessSubscription,
  type ClassSlot,
  type Minor,
  type CartItem,
} from "@gym/domain";

export interface ScanResult extends AccessDecision {
  member?: Member | null;
  planName?: string;
  sessionsLeft?: number | null;
}

export class MockApiClient {
  private currentShift: Shift | null = { ...MOCK_CURRENT_SHIFT };
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
    // Defaults to reception staff (Sarah)
    return { ...MOCK_STAFF[2]! };
  }

  async listMembers(): Promise<Member[]> {
    return [...MOCK_MEMBERS];
  }

  async getMemberById(id: string): Promise<Member | null> {
    const found = MOCK_MEMBERS.find((m) => m.id === id);
    return found ? { ...found } : null;
  }

  async getMemberByCode(code: string): Promise<Member | null> {
    const cleanCode = code.trim();
    const found = MOCK_MEMBERS.find((m) => m.code === cleanCode);
    return found ? { ...found } : null;
  }

  async getMemberByPhone(phone: string): Promise<Member | null> {
    const clean = phone.trim();
    const found = MOCK_MEMBERS.find((m) => m.phone === clean);
    return found ? { ...found } : null;
  }

  async searchMembers(query: string): Promise<Member[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [...MOCK_MEMBERS];
    return MOCK_MEMBERS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.code.includes(q) ||
        m.phone.includes(q) ||
        (m.email && m.email.toLowerCase().includes(q))
    );
  }

  async listPlans(): Promise<Plan[]> {
    return [...MOCK_PLANS];
  }

  async getPlanById(id: string): Promise<Plan | null> {
    const plan = MOCK_PLANS.find((p) => p.id === id);
    return plan ? { ...plan } : null;
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return [...this.subscriptions];
  }

  async getMemberSubscriptions(memberId: string): Promise<Subscription[]> {
    return this.subscriptions.filter((s) => s.memberId === memberId);
  }

  async unfreezeSubscription(subscriptionId: string): Promise<Subscription> {
    const sub = this.subscriptions.find((s) => s.id === subscriptionId);
    if (!sub) throw new Error("Subscription not found");
    sub.status = "ACTIVE";
    return { ...sub };
  }

  async getMemberInvoices(memberId: string): Promise<InvoiceDetail[]> {
    return this.invoices
      .filter((inv) => inv.memberId === memberId)
      .map((inv) => this.buildInvoiceDetail(inv));
  }

  async listPayments(): Promise<Payment[]> {
    return [...this.payments];
  }

  // Shift Management (Shift Gate)
  async getCurrentShift(): Promise<Shift | null> {
    return this.currentShift ? { ...this.currentShift } : null;
  }

  async openShift(staffId: string, openingCash: Minor): Promise<Shift> {
    const newShift: Shift = {
      id: `shift_${Date.now()}`,
      gymId: MOCK_GYM.id,
      staffId,
      status: "OPEN",
      openedAt: new Date().toISOString(),
      closedAt: null,
      openingCash,
      expectedCash: openingCash,
      countedCash: null,
      variance: null,
      note: `وردية مفتوحة - عهدة افتتاحية ${(openingCash / 100).toFixed(2)} ج.م`,
    };
    this.currentShift = newShift;
    return { ...newShift };
  }

  async closeShift(shiftId: string, countedCash: Minor, note?: string): Promise<Shift> {
    if (!this.currentShift || this.currentShift.id !== shiftId) {
      throw new Error("Shift not found or already closed");
    }
    const expected = this.currentShift.expectedCash ?? this.currentShift.openingCash;
    const variance = countedCash - expected;
    this.currentShift = {
      ...this.currentShift,
      status: "CLOSED",
      closedAt: new Date().toISOString(),
      countedCash,
      variance,
      note: note || this.currentShift.note,
    };
    return { ...this.currentShift };
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
