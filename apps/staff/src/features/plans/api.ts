import { http } from "../../lib/api";
import type {
  CreatePlanDto,
  UpdatePlanDto,
  Plan,
  Service,
  Subscription,
} from "@gym/contracts";

export interface ListPlansParams {
  kind?: string;
  active?: boolean;
}

export const plansApi = {
  listPlans: async (params?: ListPlansParams): Promise<Plan[]> => {
    const query = new URLSearchParams();
    if (params?.kind && params.kind !== "ALL") {
      query.set("kind", params.kind);
    }
    if (params?.active !== undefined) {
      query.set("active", String(params.active));
    }
    const qs = query.toString();
    return http.get<Plan[]>(`/plans${qs ? `?${qs}` : ""}`);
  },

  getPlan: async (id: string): Promise<Plan> => {
    return http.get<Plan>(`/plans/${id}`);
  },

  createPlan: async (dto: CreatePlanDto): Promise<Plan> => {
    return http.post<Plan>("/plans", dto);
  },

  updatePlan: async (id: string, dto: UpdatePlanDto): Promise<Plan> => {
    return http.patch<Plan>(`/plans/${id}`, dto);
  },

  archivePlan: async (id: string): Promise<{ success: boolean }> => {
    return http.post<{ success: boolean }>(`/plans/${id}/archive`);
  },

  restorePlan: async (id: string): Promise<{ success: boolean }> => {
    return http.post<{ success: boolean }>(`/plans/${id}/restore`);
  },

  listServices: async (): Promise<Service[]> => {
    return http.get<Service[]>("/services").catch(() => []);
  },

  listSubscriptions: async (): Promise<Subscription[]> => {
    return http.get<Subscription[]>("/subscriptions").catch(() => []);
  },

  getGymSettings: async (): Promise<any> => {
    return http.get<any>("/gym/settings").catch(() => null);
  },
};
