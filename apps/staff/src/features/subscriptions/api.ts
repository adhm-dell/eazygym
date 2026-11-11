import { http } from "../../lib/api";
import type {
  FreezeSubscriptionDto,
  UnfreezeSubscriptionDto,
  CancelSubscriptionDto,
  ChangeCoachDto,
  LogPtSessionDto,
  Staff,
} from "@gym/contracts";

export interface SubscriptionItem {
  id: string;
  gymId: string;
  memberId: string;
  member: {
    id: string;
    name: string;
    phone: string;
    code: string;
    isBlocked?: boolean;
    blockedReason?: string | null;
  };
  planId: string;
  plan: {
    id: string;
    name: string;
    kind: "GYM" | "PT" | "CLASS";
    dueAfterDays?: number | null;
    dueAfterPercent?: number | null;
    freezeMaxCount?: number;
    freezeMaxTotalDays?: number;
  };
  kind: "GYM" | "PT" | "CLASS";
  status:
    | "ACTIVE"
    | "PENDING_PAYMENT"
    | "FROZEN"
    | "SUSPENDED_UNPAID"
    | "EXPIRED"
    | "CANCELLED";
  price: number;
  collected: number;
  remaining: number;
  startDate: string;
  endDate: string;
  durationDays: number;
  daysLeft: number;
  sessionsLeft: number | null;
  totalSessions: number | null;
  usedSessions: number;
  freezeRemainingCount: number;
  freezeRemainingDays: number;
  freezeMaxCount: number;
  freezeMaxTotalDays: number;
  freezeUsedCount: number;
  freezeUsedDays: number;
  activeCoach: { id: string; name: string } | null;
  currentCoach: { id: string; name: string } | null;
  freezes: any[];
  isOverdue: boolean;
  isFrozen: boolean;
  invoice: any | null;
  createdAt: string;
}

export interface SubscriptionsSummary {
  totalActive: number;
  totalExpiringSoon: number;
  totalOverdueAmount: number; // in piasters
  totalPendingPayment: number;
}

export interface PaginatedSubscriptionsResult {
  items: SubscriptionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: SubscriptionsSummary;
}

export interface SubscriptionsQueryParams {
  status?: string;
  kind?: string;
  planId?: string;
  coachId?: string;
  memberId?: string;
  search?: string;
  expiringInDays?: number;
  overdue?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const subscriptionsApi = {
  listSubscriptions: (
    params: SubscriptionsQueryParams = {}
  ): Promise<PaginatedSubscriptionsResult> => {
    const q = new URLSearchParams();
    if (params.status && params.status !== "ALL") q.set("status", params.status);
    if (params.kind && params.kind !== "ALL") q.set("kind", params.kind);
    if (params.planId && params.planId !== "ALL") q.set("planId", params.planId);
    if (params.coachId && params.coachId !== "ALL") q.set("coachId", params.coachId);
    if (params.memberId) q.set("memberId", params.memberId);
    if (params.search && params.search.trim()) q.set("search", params.search.trim());
    if (params.expiringInDays !== undefined) q.set("expiringInDays", String(params.expiringInDays));
    if (params.overdue) q.set("overdue", "true");
    if (params.startDate) q.set("startDate", params.startDate);
    if (params.endDate) q.set("endDate", params.endDate);
    q.set("page", String(params.page || 1));
    q.set("limit", String(params.limit || 20));

    return http.get<PaginatedSubscriptionsResult>(`/subscriptions?${q.toString()}`);
  },

  listPlans: (): Promise<any[]> => http.get<any[]>("/plans"),

  listCoaches: (): Promise<Staff[]> =>
    http.get<Staff[]>("/staff").then((list) => list.filter((s) => s.role === "COACH" && s.isActive)),

  freezeSubscription: (subscriptionId: string, dto?: FreezeSubscriptionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/freeze`, dto || {}),

  unfreezeSubscription: (subscriptionId: string, dto?: UnfreezeSubscriptionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/unfreeze`, dto || {}),

  cancelSubscription: (subscriptionId: string, dto: CancelSubscriptionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/cancel`, dto),

  changeCoach: (subscriptionId: string, dto: ChangeCoachDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/transfer-coach`, dto),

  changeClassSlot: (subscriptionId: string, dto: { classSlotIds: string[]; reason?: string | null }) =>
    http.post<any>(`/subscriptions/${subscriptionId}/change-class-slot`, dto),

  logPtSession: (subscriptionId: string, dto?: LogPtSessionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/log-pt-session`, dto || {}),

  collectPayment: (
    invoiceId: string,
    dto: { payments: { method: "CASH" | "INSTAPAY" | "CARD"; amount: number; reference?: string | null }[] }
  ) => http.post<any>(`/invoices/${invoiceId}/payments`, dto),

  renewSubscription: (
    subscriptionId: string,
    dto?: {
      planId?: string;
      coachId?: string;
      payments?: { method: "CASH" | "CARD" | "INSTAPAY" | "WALLET"; amount: number; reference?: string | null }[];
      notes?: string;
    }
  ) => http.post<any>(`/subscriptions/${subscriptionId}/renew`, dto || {}),
};

