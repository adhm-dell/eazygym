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
} from "./types";
import { evaluateAccess, type AccessDecision, type AccessSubscription } from "@gym/domain";

export interface ScanResult extends AccessDecision {
  member?: Member | null;
  planName?: string;
  sessionsLeft?: number | null;
}

export class MockApiClient {
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
    // Defaults to reception staff
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
    return [...MOCK_SUBSCRIPTIONS];
  }

  async getMemberSubscriptions(memberId: string): Promise<Subscription[]> {
    return MOCK_SUBSCRIPTIONS.filter((s) => s.memberId === memberId);
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

  async getCurrentShift(): Promise<Shift> {
    return { ...MOCK_CURRENT_SHIFT };
  }

  /**
   * Evaluates turnstile/door scan using pure @gym/domain `evaluateAccess`.
   */
  async evaluateDoorScan(code: string, now: Date = new Date("2026-11-04T07:00:00Z")): Promise<ScanResult> {
    const member = await this.getMemberByCode(code);
    if (!member) {
      return {
        allowed: false,
        reason: "NO_SUBSCRIPTION",
        member: null,
      };
    }

    const memberSubs = await this.getMemberSubscriptions(member.id);

    // Map mock subscriptions to domain AccessSubscription shape
    const accessSubs: AccessSubscription[] = memberSubs.map((sub) => {
      const plan = MOCK_PLANS.find((p) => p.id === sub.planId);
      return {
        id: sub.id,
        kind: sub.kind,
        grantsFloorAccess: plan?.grantsFloorAccess ?? true,
        startDate: new Date(sub.startDate),
        endDate: new Date(sub.endDate),
        cancelled: sub.status === "CANCELLED",
        activated: sub.status !== "PENDING_PAYMENT",
        frozen: sub.status === "FROZEN",
        overdue: sub.status === "SUSPENDED_UNPAID",
        sessionsLeft: sub.sessionsLeft ?? null,
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
      }
    );

    const activeSub = memberSubs.find((s) => s.id === decision.subscriptionId);
    const plan = activeSub ? MOCK_PLANS.find((p) => p.id === activeSub.planId) : null;

    return {
      ...decision,
      member,
      planName: plan?.name,
      sessionsLeft: activeSub?.sessionsLeft,
    };
  }
}

export const mockClient = new MockApiClient();
