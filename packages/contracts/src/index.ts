import { z } from "zod";
import type { PlanKind, AccessReason } from "@gym/domain";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const StaffRoleSchema = z.enum([
  "SUPER_ADMIN",
  "GYM_ADMIN",
  "RECEPTION",
  "BAR_CASHIER",
  "COACH",
]);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const PlanKindSchema = z.enum(["GYM", "PT", "CLASS"]);

export const SubscriptionStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "ACTIVE",
  "FROZEN",
  "SUSPENDED_UNPAID",
  "EXPIRED",
  "CANCELLED",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const PaymentMethodSchema = z.enum(["CASH", "INSTAPAY", "CARD", "WALLET"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const InvoiceStatusSchema = z.enum(["OPEN", "PAID", "VOID"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const ShiftStatusSchema = z.enum(["OPEN", "CLOSED"]);
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;

// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserDtoSchema = z.object({
  id: z.string(),
  gymId: z.string().nullable(),
  name: z.string(),
  email: z.string().email(),
  role: StaffRoleSchema,
});
export type AuthUserDto = z.infer<typeof AuthUserDtoSchema>;

export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: AuthUserDtoSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ---------------------------------------------------------------------------
// Member DTOs
// ---------------------------------------------------------------------------

export const CreateMemberSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateMemberDto = z.infer<typeof CreateMemberSchema>;

export const UpdateMemberSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type UpdateMemberDto = z.infer<typeof UpdateMemberSchema>;

export const BlockMemberSchema = z.object({
  reason: z.string().min(1),
});
export type BlockMemberDto = z.infer<typeof BlockMemberSchema>;

export const MemberDtoSchema = z.object({
  id: z.string(),
  gymId: z.string(),
  code: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  birthDate: z.string().nullable(),
  gender: z.string().nullable(),
  notes: z.string().nullable(),
  isBlocked: z.boolean(),
  blockedReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MemberDto = z.infer<typeof MemberDtoSchema>;

// ---------------------------------------------------------------------------
// Subscription Management & Actions DTOs
// ---------------------------------------------------------------------------

export const FreezeSubscriptionSchema = z.object({
  days: z.number().int().min(1).optional(),
  startsAt: z.string().optional(),
  reason: z.string().optional().nullable(),
});
export type FreezeSubscriptionDto = z.infer<typeof FreezeSubscriptionSchema>;

export const UnfreezeSubscriptionSchema = z.object({
  endedAt: z.string().optional(),
});
export type UnfreezeSubscriptionDto = z.infer<typeof UnfreezeSubscriptionSchema>;

export const CancelSubscriptionSchema = z.object({
  reason: z.string().min(1),
});
export type CancelSubscriptionDto = z.infer<typeof CancelSubscriptionSchema>;

export const ChangeCoachSchema = z.object({
  newCoachId: z.string().min(1),
  effectiveAt: z.string().optional(),
  reason: z.string().optional().nullable(),
});
export type ChangeCoachDto = z.infer<typeof ChangeCoachSchema>;

export const LogPtSessionSchema = z.object({
  notes: z.string().optional().nullable(),
});
export type LogPtSessionDto = z.infer<typeof LogPtSessionSchema>;

// ---------------------------------------------------------------------------
// Visitor Invitations DTOs
// ---------------------------------------------------------------------------

export const CreateVisitorSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  notes: z.string().optional().nullable(),
});
export type CreateVisitorDto = z.infer<typeof CreateVisitorSchema>;

export const CheckInVisitorSchema = z.object({
  visitorId: z.string().min(1),
  invitedByMemberId: z.string().min(1),
  subscriptionId: z.string().optional().nullable(),
});
export type CheckInVisitorDto = z.infer<typeof CheckInVisitorSchema>;

export const VisitorDtoSchema = z.object({
  id: z.string(),
  gymId: z.string(),
  name: z.string(),
  phone: z.string(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type VisitorDto = z.infer<typeof VisitorDtoSchema>;

// ---------------------------------------------------------------------------
// Access / Scan DTOs
// ---------------------------------------------------------------------------

export const ScanRequestSchema = z.object({
  code: z.string().min(1),
  timestamp: z.string().optional(),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const ScanResponseSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  member: MemberDtoSchema.optional(),
  planName: z.string().optional(),
  daysLeft: z.number().optional(),
  expiringSoon: z.boolean().optional(),
});
export type ScanResponse = z.infer<typeof ScanResponseSchema>;

// ---------------------------------------------------------------------------
// Shift DTOs
// ---------------------------------------------------------------------------

export const OpenShiftSchema = z.object({
  openingCash: z.number().int().min(0), // in integer piasters
});
export type OpenShiftDto = z.infer<typeof OpenShiftSchema>;

export const CloseShiftSchema = z.object({
  countedCash: z.number().int().min(0), // in integer piasters
  note: z.string().optional(),
});
export type CloseShiftDto = z.infer<typeof CloseShiftSchema>;

export const ShiftDtoSchema = z.object({
  id: z.string(),
  gymId: z.string(),
  staffId: z.string(),
  status: ShiftStatusSchema,
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  openingCash: z.number().int(),
  expectedCash: z.number().int().nullable(),
  countedCash: z.number().int().nullable(),
  variance: z.number().int().nullable(),
  note: z.string().nullable(),
});
export type ShiftDto = z.infer<typeof ShiftDtoSchema>;

// ---------------------------------------------------------------------------
// POS & Invoicing DTOs
// ---------------------------------------------------------------------------

export const InvoiceItemKindSchema = z.enum(["SUBSCRIPTION", "SERVICE", "PRODUCT"]);
export type InvoiceItemKind = z.infer<typeof InvoiceItemKindSchema>;

export const CreateInvoiceItemSchema = z.object({
  kind: InvoiceItemKindSchema,
  planId: z.string().optional(),
  serviceId: z.string().optional(),
  productId: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0).optional(),
  subscription: z
    .object({
      startDate: z.string().optional(),
      coachId: z.string().optional(),
      classSlotIds: z.array(z.string()).optional(),
      freezeMaxCount: z.number().int().min(0).optional(),
      freezeMaxTotalDays: z.number().int().min(0).optional(),
    })
    .optional(),
});
export type CreateInvoiceItemDto = z.infer<typeof CreateInvoiceItemSchema>;

export const PaymentRowSchema = z.object({
  method: PaymentMethodSchema,
  amount: z.number().int().min(1),
  reference: z.string().optional().nullable(),
});
export type PaymentRowDto = z.infer<typeof PaymentRowSchema>;

export const CreateInvoiceSchema = z.object({
  memberId: z.string().optional().nullable(),
  items: z.array(CreateInvoiceItemSchema).min(1),
  promotionCode: z.string().optional().nullable(),
  promotionId: z.string().optional().nullable(),
  manualDiscount: z
    .object({
      amount: z.number().int().min(0),
      note: z.string(),
    })
    .optional()
    .nullable(),
  payments: z.array(PaymentRowSchema).default([]),
  useWallet: z.boolean().default(true),
  note: z.string().optional().nullable(),
});
export type CreateInvoiceDto = z.infer<typeof CreateInvoiceSchema>;

export const CollectPaymentSchema = z.object({
  payments: z.array(PaymentRowSchema).min(1),
});
export type CollectPaymentDto = z.infer<typeof CollectPaymentSchema>;

export const VoucherTypeSchema = z.enum(["RECEIPT", "DISBURSEMENT"]);
export type VoucherType = z.infer<typeof VoucherTypeSchema>;

export const CreateVoucherSchema = z.object({
  type: VoucherTypeSchema,
  memberId: z.string().optional().nullable(),
  method: z.enum(["CASH", "INSTAPAY", "CARD"]),
  amount: z.number().int().min(1),
  reason: z.string().min(1),
  creditToWallet: z.boolean().optional(),
});
export type CreateVoucherDto = z.infer<typeof CreateVoucherSchema>;

// ---------------------------------------------------------------------------
// Shift & Expense DTOs
// ---------------------------------------------------------------------------

export const AdminCloseAllShiftsSchema = z.object({
  note: z.string().min(1),
});
export type AdminCloseAllShiftsDto = z.infer<typeof AdminCloseAllShiftsSchema>;

export const ExpenseCategorySchema = z.enum([
  "CLEANING",
  "MAINTENANCE",
  "OFFICE_SUPPLIES",
  "BEVERAGES",
  "MARKETING",
  "OTHER",
]);
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

export const CreateExpenseSchema = z.object({
  category: z.string().min(1),
  amount: z.number().int().min(1),
  description: z.string().optional().nullable(),
  paidFromDrawer: z.boolean().default(true),
});
export type CreateExpenseDto = z.infer<typeof CreateExpenseSchema>;

export const VoidExpenseSchema = z.object({
  voidReason: z.string().min(1),
});
export type VoidExpenseDto = z.infer<typeof VoidExpenseSchema>;

// ---------------------------------------------------------------------------
// Common DTOs
// ---------------------------------------------------------------------------

export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  uptime: z.number(),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

