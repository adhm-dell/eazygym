import { http } from "../../lib/api";

export const scanApi = {
  evaluateDoorScan: async (code: string, now?: Date) => {
    return http.post<any>("/access/scan", {
      code,
      timestamp: now ? now.toISOString() : undefined,
    });
  },
  listAccessLogs: async (limit: number = 20) => {
    return http.get<any[]>(`/access/logs?limit=${limit}`);
  },
  unfreezeSubscription: async (subscriptionId: string) => {
    return http.post<any>(`/subscriptions/${subscriptionId}/unfreeze`);
  },
  listTodayClassSchedules: async () => {
    return http.get<any[]>("/classes/today").catch(() => []);
  },
  startClass: async (classScheduleId: string) => {
    return http.post<any>(`/classes/${classScheduleId}/start`).catch(() => null);
  },
  endClass: async (sessionId: string) => {
    return http.post<any>(`/classes/${sessionId}/end`).catch(() => null);
  },
};
