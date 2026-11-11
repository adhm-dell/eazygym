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

export const UserRoleSchema = z.enum([
  "SUPER_ADMIN",
  "GYM_ADMIN",
  "RECEPTION",
  "BAR_CASHIER",
  "COACH",
  "MEMBER",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

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

export const MemberLoginRequestSchema = z.object({
  phone: z.string().min(4),
  password: z.string().min(4),
});
export type MemberLoginRequest = z.infer<typeof MemberLoginRequestSchema>;

export const SetMemberPasswordSchema = z.object({
  password: z.string().min(4),
});
export type SetMemberPasswordDto = z.infer<typeof SetMemberPasswordSchema>;

export const CreateStaffSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: StaffRoleSchema,
  baseSalary: z.number().int().nonnegative().optional(),
  password: z.string().min(10),
});
export type CreateStaffDto = z.infer<typeof CreateStaffSchema>;

export const UpdateStaffSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  role: StaffRoleSchema.optional(),
  baseSalary: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});
export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>;

export const UpdateGymSettingsSchema = z.object({
  name: z.string().optional(),
  defaultMinUpfrontPercent: z.number().min(0).max(100).optional(),
  defaultDueAfterDays: z.number().int().nonnegative().nullable().optional(),
  defaultDueAfterPercent: z.number().min(0).max(100).nullable().optional(),
  classEntryMode: z.enum(["RECEPTION_STARTS", "SCHEDULED"]).optional(),
  classCheckinEarlyMinutes: z.number().int().nonnegative().optional(),
  expiryNotifyDays: z.array(z.number().int().nonnegative()).optional(),
  maxCoachBreaksPerDay: z.number().int().nonnegative().optional(),
  coachBreakDurationMinutes: z.number().int().nonnegative().optional(),
  freeSessionsOnFitnessProfile: z.number().int().nonnegative().optional(),
  manualDiscountLimitPercent: z.number().min(0).max(100).optional(),
  timezone: z.string().optional(),
});
export type UpdateGymSettingsDto = z.infer<typeof UpdateGymSettingsSchema>;

export const AuditQuerySchema = z.object({
  entityType: z.string().optional(),
  actorId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type AuditQueryDto = z.infer<typeof AuditQuerySchema>;

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

export const ChangeClassSlotSchema = z.object({
  classSlotIds: z.array(z.string().min(1)).min(1),
  reason: z.string().optional().nullable(),
});
export type ChangeClassSlotDto = z.infer<typeof ChangeClassSlotSchema>;

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
  subscriptionId: z.string().optional(),
});
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

export const ScanResponseSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  member: MemberDtoSchema.optional(),
  planName: z.string().optional(),
  daysLeft: z.number().optional(),
  expiringSoon: z.boolean().optional(),
  hasMultipleSubscriptions: z.boolean().optional(),
  activeSubscriptions: z.array(z.any()).optional(),
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
      bundleId: z.string().optional(),
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

// ---------------------------------------------------------------------------
// Health & Catalog DTOs
// ---------------------------------------------------------------------------

export const PlanIncludedServiceItemSchema = z.object({
  serviceId: z.string(),
  quantity: z.number().int().nonnegative().nullable().optional(),
});
export type PlanIncludedServiceItemDto = z.infer<typeof PlanIncludedServiceItemSchema>;

export const CreatePlanSchema = z.object({
  name: z.string().min(1),
  kind: PlanKindSchema,
  price: z.number().int().nonnegative(),
  durationDays: z.number().int().positive(),
  grantsFloorAccess: z.boolean().optional(),
  totalSessions: z.number().int().positive().nullable().optional(),
  sessionsPerWeek: z.number().int().positive().nullable().optional(),
  classScheduleId: z.string().nullable().optional(),
  freezeMaxCount: z.number().int().nonnegative().default(0),
  freezeMaxTotalDays: z.number().int().nonnegative().default(0),
  minUpfrontPercent: z.number().min(0).max(100).nullable().optional(),
  dueAfterDays: z.number().int().nonnegative().nullable().optional(),
  dueAfterPercent: z.number().min(0).max(100).nullable().optional(),
  maxInvitations: z.number().int().nonnegative().default(0),
  freePtSessions: z.number().int().nonnegative().default(0),
  commissionable: z.boolean().optional(),
  commissionMilestones: z.number().int().positive().default(1),
  isActive: z.boolean().optional(),
  includedServices: z.array(PlanIncludedServiceItemSchema).optional(),
});
export type CreatePlanDto = z.infer<typeof CreatePlanSchema>;

export const UpdatePlanSchema = CreatePlanSchema.partial();
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;

export const CreateServiceSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  sellableAtPos: z.boolean().default(true),
});
export type CreateServiceDto = z.infer<typeof CreateServiceSchema>;

export const UpdateServiceSchema = z.object({
  name: z.string().optional(),
  price: z.number().int().nonnegative().optional(),
  sellableAtPos: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateServiceDto = z.infer<typeof UpdateServiceSchema>;

export const CreateProductSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
});
export type CreateProductDto = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().optional(),
  price: z.number().int().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export const PromotionTypeSchema = z.enum(["PERCENT", "FIXED"]);
export type PromotionType = z.infer<typeof PromotionTypeSchema>;

export const CreatePromotionSchema = z.object({
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  type: PromotionTypeSchema,
  value: z.number().nonnegative(),
  maxDiscount: z.number().int().nonnegative().nullable().optional(),
  minSubtotal: z.number().int().nonnegative().nullable().optional(),
  itemKinds: z.array(z.enum(["SUBSCRIPTION", "SERVICE", "PRODUCT"])).default([]),
  planIds: z.array(z.string()).default([]),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  perMemberLimit: z.number().int().positive().nullable().optional(),
});
export type CreatePromotionDto = z.infer<typeof CreatePromotionSchema>;

export const UpdatePromotionSchema = CreatePromotionSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdatePromotionDto = z.infer<typeof UpdatePromotionSchema>;

export const CartItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["SUBSCRIPTION", "SERVICE", "PRODUCT"]),
  planId: z.string().nullable().optional(),
  total: z.number().int().nonnegative(),
});
export type CartItemDto = z.infer<typeof CartItemSchema>;

export const PromotionPreviewSchema = z.object({
  promotionId: z.string().optional(),
  code: z.string().optional(),
  memberId: z.string().optional(),
  items: z.array(CartItemSchema).min(1),
});
export type PromotionPreviewDto = z.infer<typeof PromotionPreviewSchema>;

// ---------------------------------------------------------------------------
// Classes & Exceptions DTOs
// ---------------------------------------------------------------------------

export const CreateClassScheduleSchema = z.object({
  name: z.string().min(1),
  coachId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().positive().default(20),
});
export type CreateClassScheduleDto = z.infer<typeof CreateClassScheduleSchema>;

export const UpdateClassScheduleSchema = CreateClassScheduleSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateClassScheduleDto = z.infer<typeof UpdateClassScheduleSchema>;

export const CreateClassExceptionSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  isCancelled: z.boolean().default(false),
  newStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  newEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  substituteCoachId: z.string().optional().nullable(),
});
export type CreateClassExceptionDto = z.infer<typeof CreateClassExceptionSchema>;

export const StartClassSchema = z.object({
  actualCoachId: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export type StartClassDto = z.infer<typeof StartClassSchema>;

export const CloseAllShiftsSchema = z.object({
  note: z.string().min(1),
});
export type CloseAllShiftsDto = z.infer<typeof CloseAllShiftsSchema>;

// ---------------------------------------------------------------------------
// Coach Operations DTOs (B07 & Phase 10)
// ---------------------------------------------------------------------------

export const CreateCoachShiftSchema = z.object({
  coachId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});
export type CreateCoachShiftDto = z.infer<typeof CreateCoachShiftSchema>;

export const CreateCoachWeeklyScheduleSchema = z.object({
  coachId: z.string().min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  replaceExisting: z.boolean().optional().default(true),
});
export type CreateCoachWeeklyScheduleDto = z.infer<typeof CreateCoachWeeklyScheduleSchema>;

export const UpdateCoachShiftSchema = CreateCoachShiftSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCoachShiftDto = z.infer<typeof UpdateCoachShiftSchema>;

export const RequestCoachBreakSchema = z.object({
  coachId: z.string().min(1),
  reason: z.string().optional().nullable(),
});
export type RequestCoachBreakDto = z.infer<typeof RequestCoachBreakSchema>;

export const RejectCoachBreakSchema = z.object({
  reason: z.string().min(1),
});
export type RejectCoachBreakDto = z.infer<typeof RejectCoachBreakSchema>;

export const NotifyBreakReturnSchema = z.object({
  coachId: z.string().min(1),
});
export type NotifyBreakReturnDto = z.infer<typeof NotifyBreakReturnSchema>;

export const UpdateFitnessProfileSchema = z.object({
  goals: z.string().optional().nullable(),
  medicalConditions: z.string().optional().nullable(),
  injuries: z.string().optional().nullable(),
  previousGymExperience: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type UpdateFitnessProfileDto = z.infer<typeof UpdateFitnessProfileSchema>;

export const FitnessAssessmentMetricsSchema = z.object({
  weight: z.number().optional(),
  bodyFatPercent: z.number().optional(),
  muscleMass: z.number().optional(),
  waterPercent: z.number().optional(),
  visceralFatLevel: z.number().optional(),
  bmr: z.number().optional(),
  notes: z.string().optional(),
});
export type FitnessAssessmentMetrics = z.infer<typeof FitnessAssessmentMetricsSchema>;

export const CreateFitnessAssessmentSchema = z.object({
  metrics: FitnessAssessmentMetricsSchema,
  assessmentDate: z.string().optional(),
});
export type CreateFitnessAssessmentDto = z.infer<typeof CreateFitnessAssessmentSchema>;

export const AssignFitnessProfileSchema = z.object({
  coachId: z.string().min(1),
});
export type AssignFitnessProfileDto = z.infer<typeof AssignFitnessProfileSchema>;

export const RejectFitnessAssignmentSchema = z.object({
  reason: z.string().min(1),
});
export type RejectFitnessAssignmentDto = z.infer<typeof RejectFitnessAssignmentSchema>;

export const UpdateRotationQueueSchema = z.object({
  queue: z.array(
    z.object({
      coachId: z.string().min(1),
      position: z.number().int().min(0),
    })
  ),
});
export type UpdateRotationQueueDto = z.infer<typeof UpdateRotationQueueSchema>;

export const CoachSessionTypeSchema = z.enum(["PRIVATE", "GROUP"]);
export type CoachSessionType = z.infer<typeof CoachSessionTypeSchema>;

export const CreateCoachSessionSchema = z.object({
  coachId: z.string().min(1),
  type: CoachSessionTypeSchema,
  startTime: z.string(),
  endTime: z.string(),
  capacity: z.number().int().positive().optional().nullable(),
  classScheduleId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateCoachSessionDto = z.infer<typeof CreateCoachSessionSchema>;

export const AddSessionParticipantSchema = z.object({
  memberId: z.string().min(1),
  source: z.enum(["FREE_GRANT", "PT_LINKED", "CLASS_LINKED"]),
  subscriptionId: z.string().optional().nullable(),
});
export type AddSessionParticipantDto = z.infer<typeof AddSessionParticipantSchema>;

export const RecordSessionAttendanceSchema = z.object({
  attendedMemberIds: z.array(z.string()),
});
export type RecordSessionAttendanceDto = z.infer<typeof RecordSessionAttendanceSchema>;

// ---------------------------------------------------------------------------
// Commissions & Payroll (B08 & Phase 07)
// ---------------------------------------------------------------------------

export const CommissionTierItemSchema = z.object({
  minRevenue: z.number(),
  percent: z.number(),
});
export type CommissionTierItem = z.infer<typeof CommissionTierItemSchema>;

export const SetCommissionTiersSchema = z.object({
  coachId: z.string().optional().nullable(),
  tiers: z.array(CommissionTierItemSchema),
});
export type SetCommissionTiersDto = z.infer<typeof SetCommissionTiersSchema>;

export const CreatePayrollRunSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});
export type CreatePayrollRunDto = z.infer<typeof CreatePayrollRunSchema>;

export const AddPayrollLineSchema = z.object({
  staffId: z.string().min(1),
  kind: z.enum(["BONUS", "DEDUCTION"]),
  amount: z.number().positive(),
  description: z.string().min(1),
});
export type AddPayrollLineDto = z.infer<typeof AddPayrollLineSchema>;

export const ClosePayrollRunSchema = z.object({
  note: z.string().optional(),
});
export type ClosePayrollRunDto = z.infer<typeof ClosePayrollRunSchema>;

export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  uptime: z.number(),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

// ---------------------------------------------------------------------------
// Shared Domain Entity Types for Frontends (No @gym/mock-data dependency)
// ---------------------------------------------------------------------------

export type Minor = number;

export interface Gym {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  defaultMinUpfrontPercent: number;
  defaultDueAfterDays: number | null;
  defaultDueAfterPercent: number | null;
  classEntryMode: "RECEPTION_STARTS" | "SCHEDULED";
  classCheckinEarlyMinutes: number;
  expiryNotifyDays: number[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  gymId: string;
  name: string;
  email: string;
  role: StaffRole;
  baseSalary: Minor;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Plan {
  id: string;
  gymId: string;
  name: string;
  kind: PlanKind;
  price: Minor;
  durationDays: number;
  grantsFloorAccess: boolean;
  totalSessions: number | null;
  sessionsPerWeek: number | null;
  classScheduleId?: string | null;
  classScheduleName?: string | null;
  freezeMaxCount: number;
  freezeMaxTotalDays: number;
  minUpfrontPercent: number | null;
  dueAfterDays: number | null;
  dueAfterPercent: number | null;
  commissionable: boolean;
  commissionMilestones: number;
  isActive: boolean;
  maxInvitations?: number;
  freePtSessions?: number;
  activeSubscribersCount?: number;
  includedServices?: {
    serviceId: string;
    serviceName: string;
    quantity: number | null;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string;
  gymId: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: string | null;
  gender: "MALE" | "FEMALE" | null;
  notes: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
  derivedStatus?: string;
  walletBalance?: Minor;
  activeSubscriptionsCount?: number;
  totalRemainingDebt?: Minor;
  activePlanName?: string;
  daysLeft?: number;
  currentCoachName?: string;
  activeSubscriptions?: Subscription[];
}

export interface Visitor {
  id: string;
  gymId: string;
  name: string;
  phone: string;
  notes: string | null;
  createdAt: string;
  attendances?: any[];
}

export interface MemberProfileDetail extends Member {
  walletBalance: Minor;
  activeSubscriptions: Subscription[];
  allSubscriptions: Subscription[];
  invoices: InvoiceDetail[];
  attendance: AccessLog[];
  freezeHistory: SubscriptionFreeze[];
  visitorAttendances: any[];
  totalVisits: number;
  totalSpent: Minor;
  totalRemainingDebt: Minor;
  derivedStatus: string;
}

export interface SubscriptionFreeze {
  id: string;
  subscriptionId: string;
  startedAt: string;
  plannedEndAt: string | null;
  endedAt: string | null;
  days: number | null;
  reason: string | null;
  createdById: string;
  createdAt: string;
  createdByName?: string;
}

export interface CoachAssignment {
  id: string;
  subscriptionId: string;
  coachId: string;
  fromDate: string;
  toDate: string | null;
  reason: string | null;
  createdAt: string;
  coach?: Staff;
}

export interface Subscription {
  id: string;
  gymId: string;
  memberId: string;
  planId: string;
  invoiceItemId: string | null;
  bundleId: string | null;
  kind: PlanKind;
  status: SubscriptionStatus;
  price: Minor;
  durationDays: number;
  startDate: string;
  endDate: string;
  originalEndDate: string;
  activatedAt: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  totalSessions?: number | null;
  usedSessions?: number;
  sessionsLeft?: number | null;
  freezeMaxCount?: number;
  freezeMaxTotalDays?: number;
  freezeUsedCount?: number;
  freezeUsedDays?: number;
  minUpfrontPercent?: number;
  dueAfterDays?: number | null;
  dueAfterPercent?: number | null;
  commissionMilestones?: number;
  maxInvitations?: number;
  usedInvitations?: number;
  freePtSessions?: number;
  createdById?: string;
  planName?: string;
  coachName?: string | null;
  isFutureRenewal?: boolean;
  plan?: Plan;
  member?: Member;
  currentCoach?: Staff | null;
  coachAssignment?: CoachAssignment | null;
  freezes?: SubscriptionFreeze[];
  collected?: Minor;
  remaining?: Minor;
  isOverdue?: boolean;
  balanceDueDate?: string | null;
  daysLeft?: number;
}

export interface Wallet {
  id: string;
  gymId: string;
  memberId: string;
  balance: Minor;
  updatedAt: string;
}

export interface CashVoucher {
  id: string;
  gymId: string;
  type: VoucherType;
  memberId: string | null;
  method: "CASH" | "INSTAPAY" | "CARD";
  amount: Minor;
  reason: string;
  shiftId: string;
  createdById: string;
  createdAt: string;
  walletTxId?: string | null;
}

export interface Service {
  id: string;
  gymId: string;
  name: string;
  price: Minor;
  sellableAtPos: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  gymId: string;
  name: string;
  price: Minor;
  stock: number;
  barcode?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Promotion {
  id: string;
  gymId: string;
  name: string;
  code: string | null;
  type: "PERCENT" | "FIXED";
  value: Minor;
  maxDiscount?: Minor | null;
  minSubtotal?: Minor | null;
  itemKinds: ("SUBSCRIPTION" | "SERVICE" | "PRODUCT")[];
  planIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  maxUses?: number | null;
  usedCount: number;
  perMemberLimit?: number | null;
  isActive: boolean;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  kind: "SUBSCRIPTION" | "SERVICE" | "PRODUCT";
  description: string;
  quantity: number;
  unitPrice: Minor;
  total: Minor;
  planId?: string | null;
  serviceId?: string | null;
  productId?: string | null;
}

export interface Payment {
  id: string;
  gymId: string;
  invoiceId: string;
  method: PaymentMethod;
  amount: Minor;
  shiftId: string;
  receivedById: string;
  attributedCoachId: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  gymId: string;
  number: number;
  memberId: string | null;
  status: InvoiceStatus;
  subtotal: Minor;
  discount: Minor;
  promotionId: string | null;
  discountNote: string | null;
  discountApprovedById: string | null;
  total: Minor;
  note: string | null;
  createdById: string;
  shiftId: string;
  createdAt: string;
  voidedAt: string | null;
  items?: InvoiceItem[];
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
  payments: Payment[];
  collectedAmount: Minor;
  remainingAmount: Minor;
  member?: Member | null;
  isOverdue?: boolean;
  balanceDueDate?: string | null;
  canActivate?: boolean;
  activationShortfall?: Minor;
  createdByName?: string;
  pendingApproval?: boolean;
  rotation?: {
    profileId: string;
    assignmentId?: string;
    coachId?: string;
    coachName?: string;
    status: "PENDING" | "NO_COACH_AVAILABLE";
  };
}

export interface Shift {
  id: string;
  gymId: string;
  staffId: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  closedById?: string | null;
  openingCash: Minor;
  expectedCash: Minor | null;
  countedCash: Minor | null;
  variance: Minor | null;
  note: string | null;
  staff?: Staff;
  closedBy?: Staff | null;
}

export interface Expense {
  id: string;
  gymId: string;
  shiftId: string;
  category: string;
  amount: Minor;
  description: string | null;
  paidFromDrawer: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  createdById: string;
  createdAt: string;
  createdBy?: { id: string; name: string };
  shift?: Shift;
}

export interface AccessLog {
  id: string;
  gymId: string;
  memberId: string | null;
  subscriptionId: string | null;
  allowed: boolean;
  reason: string;
  scannedAt: string;
  scannedById: string | null;
  memberName?: string;
  planName?: string;
}

export interface ClassSession {
  id: string;
  gymId: string;
  classScheduleId: string;
  date: string;
  startedAt: string;
  startedById: string;
  endedAt: string | null;
  endedById: string | null;
  actualCoachId: string | null;
  note: string | null;
}

export interface ClassScheduleWithDetails {
  id: string;
  gymId: string;
  name: string;
  coachId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
  coachName: string;
  enrolledMembersCount: number;
  todaySession: ClassSession | null;
  isCancelledToday: boolean;
  effectiveStartTime: string;
  effectiveEndTime: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "ENDED" | "CANCELLED";
}

export interface ShiftReport {
  shift: Shift & { staff?: Staff; closedBy?: Staff | null };
  openingCash: Minor;
  cashPayments: Minor;
  cashReceiptVouchers: Minor;
  expensesFromDrawer: Minor;
  cashDisbursementVouchers: Minor;
  expectedCash: Minor;
  countedCash: Minor | null;
  variance: Minor | null;
  instapayPayments: Minor;
  cardPayments: Minor;
  walletPayments: Minor;
  walletCreditsCreated: Minor;
  invoicesCount: number;
  invoicesTotal: Minor;
  discountsTotal: Minor;
  salesByKind: {
    subscriptions: Minor;
    services: Minor;
    products: Minor;
  };
  records: {
    payments: Payment[];
    vouchers: CashVoucher[];
    expenses: Expense[];
    invoices: InvoiceDetail[];
  };
}

export interface ScanResult {
  allowed: boolean;
  reason: string;
  member?: {
    id: string;
    code: string;
    name: string;
    phone?: string;
    isBlocked?: boolean;
    blockedReason?: string | null;
    remainingDebt?: number;
    walletBalance?: number;
  };
  subscription?: any;
  subscriptionId?: string;
  planName?: string;
  planKind?: string;
  daysLeft?: number;
  sessionsLeft?: number | null;
  totalSessions?: number | null;
  coachName?: string | null;
  className?: string | null;
  classTime?: string | null;
  expiringSoon?: boolean;
  nextAction?: string | null;
  duplicate?: boolean;
  hasMultipleSubscriptions?: boolean;
  activeSubscriptions?: Array<{
    id: string;
    kind: string;
    planName: string;
    daysLeft?: number;
    sessionsLeft?: number | null;
    className?: string | null;
    classTime?: string | null;
    coachName?: string | null;
  }>;
}


