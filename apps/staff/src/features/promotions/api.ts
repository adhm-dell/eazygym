import { http } from "../../lib/api";
import type { CreatePromotionDto, UpdatePromotionDto } from "@gym/contracts";

export const promotionsApi = {
  listPromotions: () => http.get<any[]>("/promotions"),
  getPromotion: (id: string) => http.get<any>(`/promotions/${id}`),
  createPromotion: (dto: CreatePromotionDto) => http.post<any>("/promotions", dto),
  updatePromotion: (id: string, dto: UpdatePromotionDto) => http.patch<any>(`/promotions/${id}`, dto),
};
