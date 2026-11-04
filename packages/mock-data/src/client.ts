import {
  MOCK_GYM,
  MOCK_STAFF,
  MOCK_MEMBERS,
  MOCK_PLANS,
  MOCK_SUBSCRIPTIONS,
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  MOCK_WALLETS,
  MOCK_CURRENT_SHIFT,
  MOCK_CLASS_SCHEDULES,
  MOCK_CLASS_EXCEPTIONS,
  MOCK_CLASS_SESSIONS,
  MOCK_SUBSCRIPTION_CLASS_SLOTS,
  MOCK_ACCESS_LOGS,
} from "./seed";
import type {
  Gym,
  Staff,
  Member,
  Plan,
  Subscription,
  Invoice,
  Payment,
  Wallet,
  Shift,
  AccessLog,
  ClassSchedule,
  ClassSession,
  ClassScheduleWithDetails,
} from "./types";
import {
  evaluateAccess,
  canStartClass,
  type AccessDecision,
  type AccessSubscription,
  type ClassSlot,
  type Minor,
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

  async listInvoices(): Promise<Invoice[]> {
    return [...MOCK_INVOICES];
  }

  async getMemberInvoices(memberId: string): Promise<Invoice[]> {
    return MOCK_INVOICES.filter((inv) => inv.memberId === memberId);
  }

  async listPayments(): Promise<Payment[]> {
    return [...MOCK_PAYMENTS];
  }

  async getMemberWallet(memberId: string): Promise<Wallet | null> {
    const wallet = MOCK_WALLETS.find((w) => w.memberId === memberId);
    return wallet ? { ...wallet } : null;
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
}

export const mockClient = new MockApiClient();
