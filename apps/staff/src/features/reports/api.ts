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

/**
 * Live notification subscriber using Server-Sent Events (SSE) with automatic fallback to polling.
 */
export function subscribeToNotifications(
  onNotification: (data: any) => void,
  fallbackPollMs = 15000
): () => void {
  let isClosed = false;
  let pollTimer: NodeJS.Timeout | null = null;
  let eventSource: EventSource | null = null;

  const startPolling = () => {
    if (pollTimer || isClosed) return;
    pollTimer = setInterval(async () => {
      try {
        const notifs = await fetchNotifications();
        onNotification(notifs);
      } catch {
        // ignore polling errors
      }
    }, fallbackPollMs);
  };

  try {
    if (typeof window !== "undefined" && window.EventSource) {
      eventSource = new EventSource("/api/v1/notifications/stream");
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onNotification(parsed);
        } catch {
          // ignore parse errors
        }
      };
      eventSource.onerror = () => {
        // Fallback to polling if SSE disconnected
        eventSource?.close();
        eventSource = null;
        startPolling();
      };
    } else {
      startPolling();
    }
  } catch {
    startPolling();
  }

  return () => {
    isClosed = true;
    if (eventSource) eventSource.close();
    if (pollTimer) clearInterval(pollTimer);
  };
}
