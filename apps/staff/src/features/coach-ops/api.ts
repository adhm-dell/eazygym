import { apiClient } from "../../lib/api";
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

export interface RotationAssignmentItem {
  id: string;
  profileId: string;
  coachId: string;
  source: "ROTATION" | "MANUAL";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  rejectionReason?: string | null;
  createdAt: string;
  coach: {
    id: string;
    name: string;
    email: string;
  };
  profile: {
    id: string;
    memberId: string;
    member: {
      id: string;
      name: string;
      phone: string;
      code: string;
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
    return apiClient.get<CoachShiftItem[]>(`/coach-shifts?${params.toString()}`);
  },

  createShift: (dto: CreateCoachShiftDto) => {
    return apiClient.post<CoachShiftItem>("/coach-shifts", dto);
  },

  deactivateShift: (id: string) => {
    return apiClient.delete(`/coach-shifts/${id}`);
  },

  getCoachesOnShift: () => {
    return apiClient.get<{ onShiftCoachIds: string[]; coaches: Array<{ id: string; name: string; role: string }> }>(
      "/coaches/on-shift"
    );
  },

  // Breaks
  getBreaks: (coachId?: string) => {
    const params = coachId ? `?coachId=${coachId}` : "";
    return apiClient.get<{ breaks: CoachBreakItem[]; activeBreak: CoachBreakItem | null }>(
      `/coach-breaks${params}`
    );
  },

  requestBreak: (dto: RequestCoachBreakDto) => {
    return apiClient.post<CoachBreakItem>("/coach-breaks", dto);
  },

  approveBreak: (id: string) => {
    return apiClient.post<CoachBreakItem>(`/coach-breaks/${id}/approve`);
  },

  rejectBreak: (id: string, dto: RejectCoachBreakDto) => {
    return apiClient.post<CoachBreakItem>(`/coach-breaks/${id}/reject`, dto);
  },

  endBreak: (id: string) => {
    return apiClient.post<CoachBreakItem>(`/coach-breaks/${id}/end`);
  },

  notifyReturn: (coachId: string) => {
    return apiClient.post("/coach-breaks/notify-return", { coachId });
  },

  // Rotation & Assignments
  getRotationQueue: () => {
    return apiClient.get<Array<{ id: string; coachId: string; position: number; coach: { id: string; name: string; email: string; isActive: boolean } }>>(
      "/coach-rotation-queue"
    );
  },

  getAssignments: (status?: string) => {
    const params = status ? `?status=${status}` : "";
    return apiClient.get<RotationAssignmentItem[]>(`/fitness-assignments${params}`);
  },

  acceptAssignment: (id: string) => {
    return apiClient.post(`/fitness-assignments/${id}/accept`);
  },

  rejectAssignment: (id: string, dto: RejectFitnessAssignmentDto) => {
    return apiClient.post(`/fitness-assignments/${id}/reject`, dto);
  },

  assignManually: (profileId: string, dto: AssignFitnessProfileDto) => {
    return apiClient.post(`/fitness-profiles/${profileId}/assign`, dto);
  },

  // Fitness Profiles & Assessments
  getFitnessProfile: (memberId: string) => {
    return apiClient.get<any>(`/members/${memberId}/fitness-profile`);
  },

  updateFitnessProfile: (memberId: string, dto: UpdateFitnessProfileDto) => {
    return apiClient.patch(`/members/${memberId}/fitness-profile`, dto);
  },

  getAssessments: (memberId: string) => {
    return apiClient.get<any[]>(`/members/${memberId}/assessments`);
  },

  createAssessment: (memberId: string, dto: CreateFitnessAssessmentDto) => {
    return apiClient.post(`/members/${memberId}/assessments`, dto);
  },

  // Sessions
  getSessions: (query?: { coachId?: string; fromDate?: string; toDate?: string }) => {
    const params = new URLSearchParams();
    if (query?.coachId) params.append("coachId", query.coachId);
    if (query?.fromDate) params.append("fromDate", query.fromDate);
    if (query?.toDate) params.append("toDate", query.toDate);
    return apiClient.get<CoachSessionItem[]>(`/coach-sessions?${params.toString()}`);
  },

  createSession: (dto: CreateCoachSessionDto) => {
    return apiClient.post<CoachSessionItem>("/coach-sessions", dto);
  },

  addParticipant: (sessionId: string, dto: AddSessionParticipantDto) => {
    return apiClient.post(`/coach-sessions/${sessionId}/participants`, dto);
  },

  recordAttendance: (sessionId: string, dto: RecordSessionAttendanceDto) => {
    return apiClient.post<{ session: CoachSessionItem; ptDeductionsCount: number; freeDeductionsCount: number }>(
      `/coach-sessions/${sessionId}/attendance`,
      dto
    );
  },

  recordNoShow: (sessionId: string) => {
    return apiClient.post(`/coach-sessions/${sessionId}/no-show`);
  },

  cancelSession: (sessionId: string) => {
    return apiClient.post(`/coach-sessions/${sessionId}/cancel`);
  },

  getTrainees: (coachId: string) => {
    return apiClient.get<any[]>(`/coaches/${coachId}/trainees`);
  },
};

