import { http } from "../../lib/api";

export interface Trainee {
  id: string;
  coachId: string;
  memberId: string;
  isActive: boolean;
  member: {
    id: string;
    code: string;
    name: string;
    phone: string;
    avatarUrl?: string;
  };
  subscription?: {
    id: string;
    planName: string;
    sessionsRemaining: number;
    daysRemaining: number;
    status: string;
  };
  lastAttendance?: string;
  fitnessProfile?: any;
}

export const traineesApi = {
  getMyTrainees: () => http.get<Trainee[]>("/me/trainees"),
  getFitnessProfile: (memberId: string) =>
    http.get<any>(`/members/${memberId}/fitness-profile`),
  updateFitnessProfile: (memberId: string, data: any) =>
    http.put<any>(`/members/${memberId}/fitness-profile`, data),
  addAssessment: (memberId: string, data: any) =>
    http.post<any>(`/members/${memberId}/fitness-assessments`, data),
  logSession: (dto: {
    coachId?: string;
    type: "PT" | "FREE_SESSION" | "GROUP";
    startTime: string;
    durationMinutes: number;
    participant: {
      memberId: string;
      subscriptionId?: string;
      source: "PT" | "FREE_SESSION" | "CLASS";
    };
  }) => http.post<any>("/coach-sessions", dto),
};
