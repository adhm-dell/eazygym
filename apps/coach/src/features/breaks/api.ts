import { http } from "../../lib/api";

export interface CoachBreak {
  id: string;
  coachId: string;
  durationMinutes?: number;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "REJECTED";
  reason?: string | null;
  startedAt: string | null;
  endedAt: string | null;
  rejectionReason: string | null;
  requestedAt: string;
}

export interface BreaksResponse {
  breaks: CoachBreak[];
  activeBreak: CoachBreak | null;
}

export const breaksApi = {
  getBreaks: async () => {
    const res = await http.get<BreaksResponse | CoachBreak[]>("/coach-breaks");
    if (res && "breaks" in res) {
      return res;
    }
    return {
      breaks: Array.isArray(res) ? res : [],
      activeBreak: Array.isArray(res) ? res.find((b: any) => b.status === "ACTIVE" || b.status === "PENDING") || null : null,
    };
  },
  requestBreak: (coachId: string, reason?: string) =>
    http.post<CoachBreak>("/coach-breaks", { coachId, reason: reason || "استراحة صلاة وغداء" }),
  endBreak: (breakId: string) =>
    http.post<any>(`/coach-breaks/${breakId}/end`, {}),
};
