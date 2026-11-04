import { apiClient } from "../../lib/api";
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
} from "@gym/mock-data";

export const sellApi = {
  listPlans: async (): Promise<Plan[]> => apiClient.listPlans(),
  listServices: async (): Promise<Service[]> => apiClient.listServices(),
  listProducts: async (): Promise<Product[]> => apiClient.listProducts(),
  listPromotions: async (): Promise<Promotion[]> => apiClient.listPromotions(),
  listMembers: async (): Promise<Member[]> => apiClient.listMembers(),
  getMember: async (id: string): Promise<Member | null> => apiClient.getMemberById(id),
  getMemberWallet: async (memberId: string): Promise<Wallet> => apiClient.getMemberWallet(memberId),
  listCoaches: async (): Promise<Staff[]> => {
    const staff = await apiClient.listStaff();
    return staff.filter((s) => s.role === "COACH" && s.isActive);
  },
  listClassSchedules: async (): Promise<ClassScheduleWithDetails[]> =>
    apiClient.listTodayClassSchedules(),
  createInvoice: async (dto: CreateInvoiceDto): Promise<InvoiceDetail> =>
    apiClient.createInvoice(dto),
  listInvoices: async (): Promise<InvoiceDetail[]> => apiClient.listInvoices(),
  getInvoice: async (id: string): Promise<InvoiceDetail | null> => apiClient.getInvoice(id),
  collectPayment: async (invoiceId: string, dto: CollectPaymentDto): Promise<InvoiceDetail> =>
    apiClient.collectInvoicePayment(invoiceId, dto),
  approveDiscount: async (invoiceId: string): Promise<InvoiceDetail> =>
    apiClient.approveInvoiceDiscount(invoiceId),
  voidInvoice: async (invoiceId: string, reason: string): Promise<InvoiceDetail> =>
    apiClient.voidInvoice(invoiceId, reason),
  createVoucher: async (dto: CreateVoucherDto): Promise<CashVoucher> =>
    apiClient.createVoucher(dto),
};

