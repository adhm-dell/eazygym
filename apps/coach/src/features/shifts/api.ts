import { http } from "../../lib/api";

export interface CoachShift {
  id: string;
  coachId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  isActive: boolean;
}

export const shiftsApi = {
  getMyShifts: () => http.get<CoachShift[]>("/coach-shifts"),
};

