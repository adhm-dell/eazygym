import { http } from "../../lib/api";

export const classesApi = {
  listTodayClassSchedules: () => http.get<any[]>("/classes/today").catch(() => []),
  startClass: (classScheduleId: string) =>
    http.post<any>(`/classes/${classScheduleId}/start`, {}),
  endClass: (classScheduleId: string) =>
    http.post<any>(`/classes/${classScheduleId}/end`, {}),
};
