import { http } from "../../lib/api";

export interface FitnessAssignment {
  id: string;
  memberId: string;
  coachId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  assignedAt: string;
  member: {
    id: string;
    code: string;
    name: string;
    phone: string;
  };
}

export const assignmentsApi = {
  getAssignments: () =>
    http.get<FitnessAssignment[]>("/fitness-assignments"),
  acceptAssignment: (id: string) =>
    http.post<any>(`/fitness-assignments/${id}/accept`, {}),
  rejectAssignment: (id: string, reason: string) =>
    http.post<any>(`/fitness-assignments/${id}/reject`, { reason }),
};

