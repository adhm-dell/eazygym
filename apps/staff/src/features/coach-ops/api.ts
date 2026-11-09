import { http } from "../../lib/api";
import type {
  CreateCoachShiftDto,
  RequestCoachBreakDto,
  RejectCoachBreakDto,
  CreateCoachSessionDto,
  AddSessionParticipantDto,
  RecordSessionAttendanceDto,
  UpdateFitnessProfileDto,
  CreateFitnessAssessmentDto,
  AssignFitnessProfileDto,
  RejectFitnessAssignmentDto,
} from "@gym/contracts";

export interface CoachShiftItem {
  id: string;
  coachId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  coach: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface CoachBreakItem {
  id: string;
  coachId: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "REJECTED";
  reason?: string | null;
  rejectionReason?: string | null;
  requestedAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  coach?: {
    id: string;
    name: string;
  };
}

export interface CoachQueueItem {
  id: string;
  coachId: string;
  position: number;
  onShift?: boolean;
  onBreak?: boolean;
  coach: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  };
}

export interface RotationAssignmentItem {
  id: string;
  profileId: string;
  coachId: string;
  source: "ROTATION" | "MANUAL";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  rejectionReason?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  coach: {
    id: string;
    name: string;
    email: string;
  };
  profile: {
    id: string;
    memberId: string;
    goals?: string | null;
    medicalConditions?: string | null;
    injuries?: string | null;
    notes?: string | null;
    member: {
      id: string;
      name: string;
      phone: string;
      code: string;
      subscriptions?: Array<{
        id: string;
        plan?: {
          id: string;
          name: string;
        };
      }>;
    };
  };
}

export interface CoachSessionItem {
  id: string;
  coachId: string;
  type: "PRIVATE" | "GROUP";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  startTime: string;
  endTime: string;
  capacity?: number | null;
  notes?: string | null;
  coach: {
    id: string;
    name: string;
    email: string;
  };
  participants: Array<{
    id: string;
    memberId: string;
    source: "FREE_GRANT" | "PT_LINKED" | "CLASS_LINKED";
    attended: boolean;
    member: {
      id: string;
      name: string;
      phone: string;
    };
  }>;
}

export const coachOpsApi = {
  // Shifts
  getShifts: (coachId?: string, dayOfWeek?: number) => {
    const params = new URLSearchParams();
    if (coachId) params.append("coachId", coachId);
    if (dayOfWeek !== undefined) params.append("dayOfWeek", dayOfWeek.toString());
    return http.get<CoachShiftItem[]>(`/coach-shifts?${params.toString()}`);
  },

  createShift: (dto: CreateCoachShiftDto) => {
    return http.post<CoachShiftItem>("/coach-shifts", dto);
  },

  deactivateShift: (id: string) => {
    return http.delete(`/coach-shifts/${id}`);
  },

  getCoachesOnShift: () => {
    return http.get<{ onShiftCoachIds: string[]; coaches: Array<{ id: string; name: string; role: string }> }>(
      "/coaches/on-shift"
    );
  },

  // Breaks
  getBreaks: (coachId?: string) => {
    const params = coachId ? `?coachId=${coachId}` : "";
    return http.get<{ breaks: CoachBreakItem[]; activeBreak: CoachBreakItem | null }>(
      `/coach-breaks${params}`
    );
  },

  requestBreak: (dto: RequestCoachBreakDto) => {
    return http.post<CoachBreakItem>("/coach-breaks", dto);
  },

  approveBreak: (id: string) => {
    return http.post<CoachBreakItem>(`/coach-breaks/${id}/approve`);
  },

  rejectBreak: (id: string, dto: RejectCoachBreakDto) => {
    return http.post<CoachBreakItem>(`/coach-breaks/${id}/reject`, dto);
  },

  endBreak: (id: string) => {
    return http.post<CoachBreakItem>(`/coach-breaks/${id}/end`);
  },

  notifyReturn: (coachId: string) => {
    return http.post("/coach-breaks/notify-return", { coachId });
  },

  // Rotation & Assignments
  getRotationQueue: () => {
    return http.get<CoachQueueItem[]>("/coach-rotation-queue");
  },

  getAssignments: (status?: string) => {
    const params = status ? `?status=${status}` : "";
    return http.get<RotationAssignmentItem[]>(`/fitness-assignments${params}`);
  },

  getAssignmentsSummary: () => {
    return http.get<{ pending: number; noCoachAvailable: number; rejectedToday: number }>(
      "/fitness-assignments/summary"
    );
  },

  acceptAssignment: (id: string) => {
    return http.post(`/fitness-assignments/${id}/accept`);
  },

  rejectAssignment: (id: string, dto: RejectFitnessAssignmentDto) => {
    return http.post(`/fitness-assignments/${id}/reject`, dto);
  },

  assignManually: (profileId: string, dto: AssignFitnessProfileDto) => {
    return http.post(`/fitness-profiles/${profileId}/assign`, dto);
  },

  // Fitness Profiles & Assessments
  getFitnessProfile: (memberId: string) => {
    return http.get<any>(`/members/${memberId}/fitness-profile`);
  },

  updateFitnessProfile: (memberId: string, dto: UpdateFitnessProfileDto) => {
    return http.patch(`/members/${memberId}/fitness-profile`, dto);
  },

  getAssessments: (memberId: string) => {
    return http.get<any[]>(`/members/${memberId}/assessments`);
  },

  createAssessment: (memberId: string, dto: CreateFitnessAssessmentDto) => {
    return http.post(`/members/${memberId}/assessments`, dto);
  },

  // Sessions
  getSessions: (query?: { coachId?: string; fromDate?: string; toDate?: string }) => {
    const params = new URLSearchParams();
    if (query?.coachId) params.append("coachId", query.coachId);
    if (query?.fromDate) params.append("fromDate", query.fromDate);
    if (query?.toDate) params.append("toDate", query.toDate);
    return http.get<CoachSessionItem[]>(`/coach-sessions?${params.toString()}`);
  },

  createSession: (dto: CreateCoachSessionDto) => {
    return http.post<CoachSessionItem>("/coach-sessions", dto);
  },

  addParticipant: (sessionId: string, dto: AddSessionParticipantDto) => {
    return http.post(`/coach-sessions/${sessionId}/participants`, dto);
  },

  recordAttendance: (sessionId: string, dto: RecordSessionAttendanceDto) => {
    return http.post<{ session: CoachSessionItem; ptDeductionsCount: number; freeDeductionsCount: number }>(
      `/coach-sessions/${sessionId}/attendance`,
      dto
    );
  },

  recordNoShow: (sessionId: string) => {
    return http.post(`/coach-sessions/${sessionId}/no-show`);
  },

  cancelSession: (sessionId: string) => {
    return http.post(`/coach-sessions/${sessionId}/cancel`);
  },

  getTrainees: (coachId: string) => {
    return http.get<any[]>(`/coaches/${coachId}/trainees`);
  },
};

