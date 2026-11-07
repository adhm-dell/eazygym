import { http } from "../../lib/api";

export interface CommissionTierItem {
  minRevenue: number;
  percent: number;
}

export interface PayrollLine {
  id: string;
  kind: "BASE_SALARY" | "COMMISSION" | "ADJUSTMENT" | "BONUS" | "DEDUCTION";
  amount: number;
  description?: string;
  collectedRevenue?: number | null;
  tierPercent?: number | null;
}

export interface StaffPayrollSummary {
  staffId: string;
  staff: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
  lines: PayrollLine[];
  netTotal: number;
}

export interface PayrollRunDetail {
  id: string;
  year: number;
  month: number;
  status: "DRAFT" | "CLOSED";
  closedAt: string | null;
  closedById: string | null;
  createdAt: string;
  staff: StaffPayrollSummary[];
  totalPayout: number;
}

export async function fetchPayrollRuns(): Promise<any[]> {
  return http.get<any[]>("/payroll/runs");
}

export async function fetchPayrollRun(id: string): Promise<PayrollRunDetail> {
  return http.get<PayrollRunDetail>(`/payroll/runs/${id}`);
}

export async function createPayrollRun(year: number, month: number): Promise<PayrollRunDetail> {
  return http.post<PayrollRunDetail>("/payroll/runs", { year, month });
}

export async function recalculatePayrollRun(id: string): Promise<PayrollRunDetail> {
  return http.post<PayrollRunDetail>(`/payroll/runs/${id}/recalculate`, {});
}

export async function closePayrollRun(id: string): Promise<any> {
  return http.post<any>(`/payroll/runs/${id}/close`, {});
}

export async function addPayrollLine(
  runId: string,
  line: { staffId: string; kind: "BONUS" | "DEDUCTION"; amount: number; description: string }
): Promise<any> {
  return http.post<any>(`/payroll/runs/${runId}/lines`, line);
}

export async function deletePayrollLine(runId: string, lineId: string): Promise<any> {
  return http.delete<any>(`/payroll/runs/${runId}/lines/${lineId}`);
}

export async function fetchCommissionTiers(coachId?: string): Promise<any[]> {
  const query = coachId ? `?coachId=${coachId}` : "";
  return http.get<any[]>(`/commission-tiers${query}`);
}

export async function saveCommissionTiers(
  tiers: CommissionTierItem[],
  coachId?: string | null
): Promise<any[]> {
  return http.put<any[]>("/commission-tiers", {
    coachId: coachId || null,
    tiers,
  });
}

export async function fetchCoachCommission(coachId: string, monthStr?: string): Promise<any> {
  const query = monthStr ? `?month=${monthStr}` : "";
  return http.get<any>(`/coaches/${coachId}/commission${query}`);
}
