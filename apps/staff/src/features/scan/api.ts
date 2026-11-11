import { http } from "../../lib/api";

export const scanApi = {
  evaluateDoorScan: async (code: string, opts?: { now?: Date; subscriptionId?: string }) => {
    return http
      .post<any>("/access/scan", {
        code,
        timestamp: opts?.now ? opts.now.toISOString() : undefined,
        subscriptionId: opts?.subscriptionId,
      })
      .catch((err) => {
        if (
          err.code === "MEMBER_NOT_FOUND" ||
          err.statusCode === 404 ||
          err.message?.includes("MEMBER_NOT_FOUND") ||
          err.message?.includes("not found")
        ) {
          return {
            allowed: false,
            reason: "MEMBER_NOT_FOUND",
            member: { id: "unknown", name: "عضو غير مسجل", code },
            subscription: null,
            expiringSoon: false,
            nextAction: "SELL",
          };
        }
        throw err;
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
    return http.post<any>(`/classes/${classScheduleId}/start`);
  },
  endClass: async (scheduleOrSessionId: string) => {
    return http.post<any>(`/classes/${scheduleOrSessionId}/end`);
  },
};
