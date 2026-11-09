import { http } from "../../lib/api";

export interface SessionParticipant {
  id: string;
  sessionId: string;
  memberId: string;
  source: "FREE_GRANT" | "PT_LINKED" | "CLASS_LINKED";
  subscriptionId?: string | null;
  attended: boolean;
  member?: {
    id: string;
    code: string;
    name: string;
    phone: string;
  };
}

export interface CoachSession {
  id: string;
  coachId: string;
  type: "PRIVATE" | "GROUP";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  startTime: string;
  endTime: string;
  capacity?: number | null;
  notes?: string | null;
  participants: SessionParticipant[];
}

export const sessionsApi = {
  getMySessions: (params?: { fromDate?: string; toDate?: string }) => {
    const q = new URLSearchParams();
    if (params?.fromDate) q.append("fromDate", params.fromDate);
    if (params?.toDate) q.append("toDate", params.toDate);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return http.get<CoachSession[]>(`/coach-sessions${qs}`);
  },

  createSession: (dto: {
    coachId: string;
    type: "PRIVATE" | "GROUP";
    startTime: string;
    endTime: string;
    capacity?: number | null;
    notes?: string | null;
  }) => http.post<CoachSession>("/coach-sessions", dto),

  addParticipant: (
    sessionId: string,
    dto: {
      memberId: string;
      source: "FREE_GRANT" | "PT_LINKED" | "CLASS_LINKED";
      subscriptionId?: string | null;
    }
  ) => http.post<any>(`/coach-sessions/${sessionId}/participants`, dto),

  recordAttendance: (sessionId: string, attendedMemberIds: string[]) =>
    http.post<any>(`/coach-sessions/${sessionId}/attendance`, { attendedMemberIds }),

  recordNoShow: (sessionId: string) =>
    http.post<any>(`/coach-sessions/${sessionId}/no-show`, {}),

  cancelSession: (sessionId: string) =>
    http.post<any>(`/coach-sessions/${sessionId}/cancel`, {}),
};

