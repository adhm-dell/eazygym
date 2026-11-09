import { http } from "../../lib/api";

export interface FitnessAssignment {
  id: string;
  memberId?: string;
  coachId: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  assignedAt?: string;
  profile?: {
    id: string;
    memberId?: string;
    member?: {
      id: string;
      code?: string;
      name: string;
      phone?: string;
    };
  };
  member: {
    id: string;
    code: string;
    name: string;
    phone: string;
  };
}

export const assignmentsApi = {
  getAssignments: async (): Promise<FitnessAssignment[]> => {
    const list = await http.get<any[]>("/fitness-assignments?status=PENDING");
    return (list || []).map((item) => {
      const mem = item.member || item.profile?.member || {};
      return {
        ...item,
        member: {
          id: mem.id || item.profile?.memberId || item.memberId || "",
          code: mem.code || "",
          name: mem.name || "عضو جديد",
          phone: mem.phone || "",
        },
      };
    });
  },
  acceptAssignment: (id: string) =>
    http.post<any>(`/fitness-assignments/${id}/accept`, {}),
  rejectAssignment: (id: string, reason: string) =>
    http.post<any>(`/fitness-assignments/${id}/reject`, { reason }),
};
