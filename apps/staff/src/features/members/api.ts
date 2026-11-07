import { apiClient } from "../../lib/api";
import type {
  CreateMemberDto,
  UpdateMemberDto,
  BlockMemberDto,
  FreezeSubscriptionDto,
  UnfreezeSubscriptionDto,
  CancelSubscriptionDto,
  ChangeCoachDto,
  LogPtSessionDto,
  CreateVisitorDto,
  CheckInVisitorDto,
} from "@gym/contracts";

export const membersApi = {
  getGym: () => apiClient.getGym(),
  listStaff: () => apiClient.listStaff(),
  listPlans: () => apiClient.listPlans(),

  listMembers: (filters?: {
    query?: string;
    status?: string;
    planKind?: string;
    coachId?: string;
    expiringInDays?: number;
    overdue?: boolean;
    blocked?: boolean;
  }) => apiClient.listMembers(filters),

  getMemberById: (id: string) => apiClient.getMemberById(id),
  getMemberProfile: (id: string) => apiClient.getMemberProfile(id),

  createMember: (dto: CreateMemberDto) => apiClient.createMember(dto),
  updateMember: (id: string, dto: UpdateMemberDto) => apiClient.updateMember(id, dto),
  blockMember: (id: string, dto: BlockMemberDto) => apiClient.blockMember(id, dto),
  unblockMember: (id: string) => apiClient.unblockMember(id),
  addMemberNote: (id: string, note: string) => apiClient.addMemberNote(id, note),

  getMemberSubscriptions: (memberId: string) => apiClient.getMemberSubscriptions(memberId),
  freezeSubscription: (subscriptionId: string, dto?: FreezeSubscriptionDto) =>
    apiClient.freezeSubscription(subscriptionId, dto),
  unfreezeSubscription: (subscriptionId: string, dto?: UnfreezeSubscriptionDto) =>
    apiClient.unfreezeSubscription(subscriptionId, dto),
  cancelSubscription: (subscriptionId: string, dto: CancelSubscriptionDto) =>
    apiClient.cancelSubscription(subscriptionId, dto),

  previewCoachTransfer: (subscriptionId: string, newCoachId: string, effectiveAt?: string) =>
    apiClient.previewCoachTransfer(subscriptionId, newCoachId, effectiveAt),
  changeCoach: (subscriptionId: string, dto: ChangeCoachDto) =>
    apiClient.changeCoach(subscriptionId, dto),
  logPtSession: (subscriptionId: string, dto?: LogPtSessionDto) =>
    apiClient.logPtSession(subscriptionId, dto),

  listVisitors: (query?: string) => apiClient.listVisitors(query),
  createVisitor: (dto: CreateVisitorDto) => apiClient.createVisitor(dto),
  checkInVisitor: (dto: CheckInVisitorDto) => apiClient.checkInVisitor(dto),

  listOverdueSubscriptions: () => apiClient.listOverdueSubscriptions(),
  collectPayment: (invoiceId: string, dto: { payments: { method: "CASH" | "INSTAPAY" | "CARD"; amount: number; reference?: string | null }[] }) =>
    apiClient.collectInvoicePayment(invoiceId, dto),
};
