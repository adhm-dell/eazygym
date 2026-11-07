import { http } from "../../lib/api";

export async function fetchDailyRevenue(date?: string): Promise<any> {
  const query = date ? `?date=${date}` : "";
  return http.get<any>(`/reports/daily-revenue${query}`);
}

export async function fetchExpiringSubscriptions(days = 7): Promise<any[]> {
  return http.get<any[]>(`/reports/expiring-subscriptions?days=${days}`);
}

export async function fetchOverdueBalances(): Promise<any[]> {
  return http.get<any[]>("/reports/overdue-balances");
}

export async function fetchPromotionUsage(): Promise<any[]> {
  return http.get<any[]>("/reports/promotion-usage");
}

export async function fetchCoachPerformance(month?: string): Promise<any[]> {
  const query = month ? `?month=${month}` : "";
  return http.get<any[]>(`/reports/coach-performance${query}`);
}

export async function fetchAuditLogs(params?: {
  entityType?: string;
  actorId?: string;
  page?: number;
  limit?: number;
}): Promise<any> {
  const searchParams = new URLSearchParams();
  if (params?.entityType) searchParams.set("entityType", params.entityType);
  if (params?.actorId) searchParams.set("actorId", params.actorId);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return http.get<any>(`/audit${query}`);
}

export async function fetchNotifications(): Promise<{ unreadCount: number; items: any[] }> {
  return http.get<{ unreadCount: number; items: any[] }>("/notifications");
}

export async function markNotificationRead(id: string): Promise<any> {
  return http.post<any>(`/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(): Promise<any> {
  return http.post<any>("/notifications/read-all", {});
}
