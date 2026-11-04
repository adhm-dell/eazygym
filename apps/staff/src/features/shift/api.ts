import { apiClient } from "../../lib/api";

export const shiftApi = {
  getCurrentShift: () => apiClient.getCurrentShift(),
  openShift: (staffId: string, openingCash: number) => apiClient.openShift(staffId, openingCash),
  closeShift: (shiftId: string, countedCash: number, note?: string) =>
    apiClient.closeShift(shiftId, countedCash, note),
};
