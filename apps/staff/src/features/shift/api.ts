import { http, setStoredToken } from "../../lib/api";
import type { CreateExpenseDto, ShiftStatus } from "@gym/mock-data";

export const shiftApi = {
  getCurrentShift: () => http.get<any>("/shifts/current").catch(() => null),
  listShifts: (_filters?: { staffId?: string; status?: ShiftStatus; hasVariance?: boolean }) => {
    return http.get<any[]>("/shifts");
  },
  getShiftById: (id: string) => http.get<any>(`/shifts/${id}`),
  getShiftReport: (id: string) => http.get<any>(`/shifts/${id}/report`).catch(() => null),
  openShift: (_staffId: string, openingCash: number) =>
    http.post<any>("/shifts/open", { openingCash }),
  closeShift: (
    shiftId: string,
    countedCash: number,
    note?: string,
    _actorId?: string,
    _actorIsAdmin?: boolean
  ) => http.post<any>(`/shifts/${shiftId}/close`, { countedCash, note }),
  adminCloseAllShifts: (note: string, _adminId?: string) =>
    http.post<any>("/shifts/close-all", { note }),

  // Expenses
  listExpenses: (filters?: { shiftId?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.shiftId) params.set("shiftId", filters.shiftId);
    if (filters?.category) params.set("category", filters.category);
    return http.get<any[]>(`/expenses${params.toString() ? `?${params.toString()}` : ""}`);
  },
  createExpense: (dto: CreateExpenseDto, _staffId?: string) =>
    http.post<any>("/expenses", dto),
  voidExpense: (expenseId: string, reason: string, _adminId?: string) =>
    http.post<any>(`/expenses/${expenseId}/void`, { reason }),

  // Staff & User
  getCurrentUser: async () => {
    try {
      const res = await http.get<any>("/me");
      return res.user || res;
    } catch {
      return null;
    }
  },
  switchActiveUser: async (staffIdOrEmail: string) => {
    const isEmail = staffIdOrEmail.includes("@");
    const payload = isEmail ? { email: staffIdOrEmail } : { staffId: staffIdOrEmail };
    const res = await http.post<any>("/auth/switch", payload);
    if (res?.accessToken) {
      setStoredToken(res.accessToken, res.user);
    }
    return res.user || res;
  },
  listStaff: () => http.get<any[]>("/staff"),
};
