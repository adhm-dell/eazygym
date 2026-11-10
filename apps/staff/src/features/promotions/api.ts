import { http } from "../../lib/api";
import type {
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionPreviewDto,
  Plan,
  Service,
  Product,
} from "@gym/contracts";

export interface Promotion {
  id: string;
  gymId: string;
  name: string;
  code: string | null;
  type: "PERCENT" | "FIXED";
  value: number; // minor units (piasters) for FIXED, 0..100 for PERCENT
  maxDiscount: number | null; // minor units (piasters)
  minSubtotal: number | null; // minor units (piasters)
  itemKinds: ("SUBSCRIPTION" | "SERVICE" | "PRODUCT")[];
  planIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  perMemberLimit: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface PromotionUsage {
  promotionId: string;
  promotionName: string;
  redemptionsCount: number;
  totalDiscount: number; // minor units (piasters)
}

export interface PromotionPreviewResult {
  applicable: boolean;
  promotionId: string;
  promotionName: string;
  discount: number; // minor units (piasters)
  perItem: { id: string; discount: number }[];
}

export const promotionsApi = {
  listPromotions: (): Promise<Promotion[]> => http.get<Promotion[]>("/promotions"),
  getPromotion: (id: string): Promise<Promotion> => http.get<Promotion>(`/promotions/${id}`),
  createPromotion: (dto: CreatePromotionDto): Promise<Promotion> =>
    http.post<Promotion>("/promotions", dto),
  updatePromotion: (id: string, dto: UpdatePromotionDto): Promise<Promotion> =>
    http.patch<Promotion>(`/promotions/${id}`, dto),
  deactivatePromotion: (id: string): Promise<{ success: boolean }> =>
    http.post<{ success: boolean }>(`/promotions/${id}/deactivate`, {}),
  activatePromotion: (id: string): Promise<{ success: boolean }> =>
    http.post<{ success: boolean }>(`/promotions/${id}/activate`, {}),
  getPromotionUsage: (id: string): Promise<PromotionUsage> =>
    http.get<PromotionUsage>(`/promotions/${id}/usage`),
  previewPromotion: (dto: PromotionPreviewDto): Promise<PromotionPreviewResult> =>
    http.post<PromotionPreviewResult>("/promotions/preview", dto),
  listPlans: (): Promise<Plan[]> => http.get<Plan[]>("/plans?active=true"),
  listServices: (): Promise<Service[]> => http.get<Service[]>("/services?active=true"),
  listProducts: (): Promise<Product[]> => http.get<Product[]>("/products?active=true"),
};
