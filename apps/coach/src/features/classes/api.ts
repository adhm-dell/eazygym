import { http } from "../../lib/api";

export const classesApi = {
  getTodayClasses: () => http.get<any[]>("/classes/today"),
};
