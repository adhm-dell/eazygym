import { http } from "../../lib/api";
import type {
  CreateInvoiceDto,
  CollectPaymentDto,
  CreateVoucherDto,
  InvoiceDetail,
  Product,
  Service,
  Plan,
  Promotion,
  Member,
  Wallet,
  CashVoucher,
  Staff,
  ClassScheduleWithDetails,
} from "@gym/contracts";

export const sellApi = {
  listPlans: async (): Promise<Plan[]> => http.get<Plan[]>("/plans"),
  listServices: async (): Promise<Service[]> => http.get<Service[]>("/services"),
  listProducts: async (): Promise<Product[]> => http.get<Product[]>("/products"),
  listPromotions: async (): Promise<Promotion[]> =>
    http.get<Promotion[]>("/promotions").catch(() => []),
  listMembers: async (): Promise<Member[]> => {
    const res = await http.get<any>("/members?limit=100");
    const items = Array.isArray(res) ? res : (res?.items || []);
    return items.map((m: any) => ({
      ...m,
      derivedStatus: m.status || m.derivedStatus || "NO_SUBSCRIPTION",
      totalRemainingDebt: m.totalRemainingDebt ?? 0,
    }));
  },
  getMember: async (id: string): Promise<Member | null> =>
    http.get<Member>(`/members/${id}`).catch(() => null),
  getMemberWallet: async (memberId: string): Promise<Wallet> => {
    const mem = await http.get<any>(`/members/${memberId}`).catch(() => null);
    return {
      id: `wallet_${memberId}`,
      gymId: "gym_cairo_01",
      memberId,
      balance: mem?.walletBalance ? Number(mem.walletBalance) : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Wallet;
  },
  listCoaches: async (): Promise<Staff[]> => {
    const staff = await http.get<Staff[]>("/staff");
    return staff.filter((s) => s.role === "COACH" && s.isActive);
  },
  listClassSchedules: async (): Promise<ClassScheduleWithDetails[]> =>
    http.get<ClassScheduleWithDetails[]>("/classes/today").catch(() => []),
  createInvoice: async (dto: CreateInvoiceDto): Promise<InvoiceDetail> =>
    http.post<InvoiceDetail>("/invoices", dto),
  listInvoices: async (): Promise<InvoiceDetail[]> => http.get<InvoiceDetail[]>("/invoices"),
  getInvoice: async (id: string): Promise<InvoiceDetail | null> =>
    http.get<InvoiceDetail>(`/invoices/${id}`).catch(() => null),
  collectPayment: async (invoiceId: string, dto: CollectPaymentDto): Promise<InvoiceDetail> =>
    http.post<InvoiceDetail>(`/invoices/${invoiceId}/payments`, dto),
  approveDiscount: async (invoiceId: string): Promise<InvoiceDetail> =>
    http.post<InvoiceDetail>(`/invoices/${invoiceId}/approve-discount`, {}),
  voidInvoice: async (invoiceId: string, reason: string): Promise<InvoiceDetail> =>
    http.post<InvoiceDetail>(`/invoices/${invoiceId}/void`, { reason }),
  createVoucher: async (dto: CreateVoucherDto): Promise<CashVoucher> =>
    http.post<CashVoucher>("/vouchers", dto),
};
