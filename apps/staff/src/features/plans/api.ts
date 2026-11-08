import { http } from "../../lib/api";
import type { CreatePlanDto, UpdatePlanDto } from "@gym/contracts";

export const plansApi = {
  listPlans: () => http.get<any[]>("/plans"),
  getPlan: (id: string) => http.get<any>(`/plans/${id}`),
  createPlan: (dto: CreatePlanDto) => http.post<any>("/plans", dto),
  updatePlan: (id: string, dto: UpdatePlanDto) => http.patch<any>(`/plans/${id}`, dto),
};
