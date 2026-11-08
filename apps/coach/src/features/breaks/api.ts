import { http } from "../../lib/api";

export interface CoachBreak {
  id: string;
  coachId: string;
  durationMinutes: number;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "REJECTED";
  startedAt: string | null;
  endedAt: string | null;
  rejectionReason: string | null;
  requestedAt: string;
}

export const breaksApi = {
  getBreaks: () => http.get<CoachBreak[]>("/coach-breaks"),
  requestBreak: (durationMinutes: number = 20) =>
    http.post<CoachBreak>("/coach-breaks", { durationMinutes }),
  endBreak: (breakId: string) =>
    http.post<any>(`/coach-breaks/${breakId}/end`, {}),
};
