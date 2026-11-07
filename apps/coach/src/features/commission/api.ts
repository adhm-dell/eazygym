import { http } from "../../lib/api";

export interface CoachCommissionData {
  coach: {
    id: string;
    name: string;
    baseSalary: number;
  };
  period: {
    year: number;
    month: number;
  };
  collectedRevenue: number;
  currentTier: {
    minRevenue: number;
    percent: number;
  };
  nextTier: {
    minRevenue: number;
    percent: number;
    neededRevenue: number;
  } | null;
  commissionAmount: number;
  totalEarnedMilestones: number;
  totalPendingMilestones: number;
  entries: Array<{
    id: string;
    subscriptionId: string;
    milestoneIndex: number;
    dueDate: string;
    baseAmount: number;
    allocatedBase: number;
    shareBps: number;
    status: "PENDING" | "EARNED" | "PAID" | "VOID";
    earnedMonth: string | null;
    member: {
      id: string;
      code: string;
      name: string;
    };
    plan: {
      id: string;
      name: string;
    };
  }>;
}

export async function fetchMyCommission(year?: number, month?: number): Promise<CoachCommissionData> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const query = params.toString() ? `?${params.toString()}` : "";
  return http.get<CoachCommissionData>(`/me/commission${query}`);
}
