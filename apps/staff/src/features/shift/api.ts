import { apiClient } from "../../lib/api";
import type { CreateExpenseDto, ShiftStatus } from "@gym/mock-data";

export const shiftApi = {
  getCurrentShift: () => apiClient.getCurrentShift(),
  listShifts: (filters?: { staffId?: string; status?: ShiftStatus; hasVariance?: boolean }) =>
    apiClient.listShifts(filters),
  getShiftById: (id: string) => apiClient.getShiftById(id),
  getShiftReport: (id: string) => apiClient.getShiftReport(id),
  openShift: (staffId: string, openingCash: number) => apiClient.openShift(staffId, openingCash),
  closeShift: (
    shiftId: string,
    countedCash: number,
    note?: string,
    actorId?: string,
    actorIsAdmin?: boolean
  ) => apiClient.closeShift(shiftId, countedCash, note, actorId, actorIsAdmin),
  adminCloseAllShifts: (note: string, adminId?: string) =>
    apiClient.adminCloseAllShifts(note, adminId),

  // Expenses
  listExpenses: (filters?: { shiftId?: string; category?: string }) =>
    apiClient.listExpenses(filters),
  createExpense: (dto: CreateExpenseDto, staffId?: string) =>
    apiClient.createExpense(dto, staffId),
  voidExpense: (expenseId: string, reason: string, adminId?: string) =>
    apiClient.voidExpense(expenseId, reason, adminId),

  // Staff & User
  getCurrentUser: () => apiClient.getCurrentUser(),
  switchActiveUser: (staffId: string) => apiClient.switchActiveUser(staffId),
  listStaff: () => apiClient.listStaff(),
};
