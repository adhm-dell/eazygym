import { http } from "../../lib/api";

export interface FitnessAssignment {
  id: string;
  memberId?: string;
  coachId: string;
  source?: "ROTATION" | "MANUAL";
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";
  assignedAt?: string;
  createdAt: string;
  respondedAt?: string;
  rejectionReason?: string | null;
  planName?: string;
  goals?: string | null;
  medicalConditions?: string | null;
  injuries?: string | null;
  notes?: string | null;
  freeSessionsCount?: number;
  profile?: {
    id: string;
    memberId?: string;
    goals?: string | null;
    medicalConditions?: string | null;
    injuries?: string | null;
    notes?: string | null;
    member?: {
      id: string;
      code?: string;
      name: string;
      phone?: string;
      subscriptions?: Array<{
        id: string;
        plan?: { id: string; name: string };
      }>;
    };
  };
  member: {
    id: string;
    code: string;
    name: string;
    phone: string;
  };
}

function mapAssignmentItem(item: any): FitnessAssignment {
  const profileMember = item.profile?.member || item.member || {};
  const plan =
    item.profile?.member?.subscriptions?.[0]?.plan?.name ||
    item.member?.subscriptions?.[0]?.plan?.name ||
    "اشتراك جديد";

  return {
    ...item,
    createdAt: item.createdAt || new Date().toISOString(),
    planName: plan,
    goals: item.profile?.goals || null,
    medicalConditions: item.profile?.medicalConditions || null,
    injuries: item.profile?.injuries || null,
    notes: item.profile?.notes || null,
    freeSessionsCount: item.freeSessionsCount ?? 1,
    member: {
      id: profileMember.id || item.profile?.memberId || item.memberId || "",
      code: profileMember.code || "",
      name: profileMember.name || "عضو جديد",
      phone: profileMember.phone || "",
    },
  };
}

export const assignmentsApi = {
  getAssignments: async (status: string = "PENDING"): Promise<FitnessAssignment[]> => {
    const query = status ? `?status=${status}` : "";
    const list = await http.get<any[]>(`/fitness-assignments${query}`);
    return (list || []).map(mapAssignmentItem);
  },

  getAllAssignments: async (): Promise<FitnessAssignment[]> => {
    const list = await http.get<any[]>("/fitness-assignments");
    return (list || []).map(mapAssignmentItem);
  },

  acceptAssignment: async (id: string) => {
    try {
      return await http.post<any>(`/fitness-assignments/${id}/accept`, {});
    } catch (err: any) {
      if (err.message === "NOT_PENDING" || err.response?.data?.message === "NOT_PENDING") {
        throw new Error("هذا الطلب لم يعد قيد الانتظار (ربما تم قبوله أو استبداله مسبقاً)");
      }
      if (err.message === "NOT_YOUR_ASSIGNMENT" || err.response?.data?.message === "NOT_YOUR_ASSIGNMENT") {
        throw new Error("هذا التكليف ليس موجهاً إليك");
      }
      throw err;
    }
  },

  rejectAssignment: async (id: string, reason: string) => {
    try {
      return await http.post<any>(`/fitness-assignments/${id}/reject`, { reason });
    } catch (err: any) {
      if (err.message === "NOT_PENDING" || err.response?.data?.message === "NOT_PENDING") {
        throw new Error("هذا الطلب لم يعد قيد الانتظار (ربما تم قبوله أو استبداله مسبقاً)");
      }
      if (err.message === "NOT_YOUR_ASSIGNMENT" || err.response?.data?.message === "NOT_YOUR_ASSIGNMENT") {
        throw new Error("هذا التكليف ليس موجهاً إليك");
      }
      throw err;
    }
  },
};
