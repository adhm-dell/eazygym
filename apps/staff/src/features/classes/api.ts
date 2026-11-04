import { apiClient } from "../../lib/api";

export const classesApi = {
  listTodayClassSchedules: (now?: Date) => apiClient.listTodayClassSchedules(now),
  startClass: (classScheduleId: string, startedById: string, now?: Date) =>
    apiClient.startClass(classScheduleId, startedById, now),
  endClass: (classSessionId: string, endedById: string, now?: Date) =>
    apiClient.endClass(classSessionId, endedById, now),
};
