import { http } from "../../lib/api";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationsResponse {
  unreadCount: number;
  items: NotificationItem[];
}

export const notificationsApi = {
  getNotifications: (): Promise<NotificationsResponse> =>
    http.get<NotificationsResponse>("/notifications"),
  markRead: (id: string): Promise<{ success: boolean }> =>
    http.post<{ success: boolean }>(`/notifications/${id}/read`, {}),
  markAllRead: (): Promise<{ success: boolean }> =>
    http.post<{ success: boolean }>("/notifications/read-all", {}),
};

