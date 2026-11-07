import { http } from "../../lib/api";
import type {
  CreateMemberDto,
  UpdateMemberDto,
  BlockMemberDto,
  FreezeSubscriptionDto,
  UnfreezeSubscriptionDto,
  CancelSubscriptionDto,
  ChangeCoachDto,
  LogPtSessionDto,
  CreateVisitorDto,
  CheckInVisitorDto,
} from "@gym/contracts";

export const membersApi = {
  getGym: () =>
    http.get<any>("/gyms/current").catch(() => ({
      id: "gym_cairo_01",
      name: "EazyGym - المعادي",
      currency: "EGP",
    })),
  listStaff: () => http.get<any[]>("/staff"),
  listPlans: () => http.get<any[]>("/plans"),

  listMembers: async (filters?: {
    query?: string;
    status?: string;
    planKind?: string;
    coachId?: string;
    expiringInDays?: number;
    overdue?: boolean;
    blocked?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (filters?.query) params.set("search", filters.query);
    if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters?.planKind && filters.planKind !== "ALL") params.set("planKind", filters.planKind);
    if (filters?.coachId && filters.coachId !== "ALL") params.set("coachId", filters.coachId);
    if (filters?.expiringInDays !== undefined) params.set("expiringInDays", String(filters.expiringInDays));
    if (filters?.overdue) params.set("overdue", "true");
    if (filters?.blocked !== undefined) params.set("blocked", String(filters.blocked));
    params.set("limit", "100");

    const res = await http.get<any>(`/members?${params.toString()}`);
    const items = Array.isArray(res) ? res : (res?.items || []);
    return items.map((m: any) => ({
      ...m,
      derivedStatus: m.status || m.derivedStatus || "NO_SUBSCRIPTION",
      totalRemainingDebt: m.totalRemainingDebt ?? 0,
    }));
  },

  getMemberById: (id: string) => http.get<any>(`/members/${id}`),
  getMemberProfile: (id: string) => http.get<any>(`/members/${id}`),

  createMember: (dto: CreateMemberDto) => http.post<any>("/members", dto),
  updateMember: (id: string, dto: UpdateMemberDto) => http.patch<any>(`/members/${id}`, dto),
  blockMember: (id: string, dto: BlockMemberDto) => http.post<any>(`/members/${id}/block`, dto),
  unblockMember: (id: string) => http.post<any>(`/members/${id}/unblock`),
  addMemberNote: (id: string, note: string) => http.patch<any>(`/members/${id}`, { notes: note }),

  getMemberSubscriptions: (memberId: string) => http.get<any[]>(`/subscriptions?memberId=${memberId}`),
  freezeSubscription: (subscriptionId: string, dto?: FreezeSubscriptionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/freeze`, dto || {}),
  unfreezeSubscription: (subscriptionId: string, dto?: UnfreezeSubscriptionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/unfreeze`, dto || {}),
  cancelSubscription: (subscriptionId: string, dto: CancelSubscriptionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/cancel`, dto),

  previewCoachTransfer: (subscriptionId: string, newCoachId: string, effectiveAt?: string) =>
    http
      .post<any>(`/subscriptions/${subscriptionId}/transfer-coach/preview`, { newCoachId, effectiveAt })
      .catch(() => ({})),
  changeCoach: (subscriptionId: string, dto: ChangeCoachDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/transfer-coach`, dto),
  logPtSession: (subscriptionId: string, dto?: LogPtSessionDto) =>
    http.post<any>(`/subscriptions/${subscriptionId}/log-pt-session`, dto || {}),

  listVisitors: (query?: string) =>
    http.get<any[]>(`/visitors${query ? `?search=${encodeURIComponent(query)}` : ""}`),
  createVisitor: (dto: CreateVisitorDto) => http.post<any>("/visitors", dto),
  checkInVisitor: (dto: CheckInVisitorDto) => http.post<any>(`/visitors/${dto.visitorId}/checkin`, dto),

  listOverdueSubscriptions: () => http.get<any[]>("/invoices/overdue").catch(() => []),
  collectPayment: (
    invoiceId: string,
    dto: { payments: { method: "CASH" | "INSTAPAY" | "CARD"; amount: number; reference?: string | null }[] }
  ) => http.post<any>(`/invoices/${invoiceId}/payments`, dto),
};
