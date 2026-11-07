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
  password: z.string().min(6).optional(),
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

export const CreatePlanSchema = z.object({
  name: z.string().min(1),
  kind: PlanKindSchema,
  price: z.number().int().nonnegative(),
  durationDays: z.number().int().positive(),
  grantsFloorAccess: z.boolean().optional(),
  totalSessions: z.number().int().positive().nullable().optional(),
  sessionsPerWeek: z.number().int().positive().nullable().optional(),
  freezeMaxCount: z.number().int().nonnegative().default(0),
  freezeMaxTotalDays: z.number().int().nonnegative().default(0),
  minUpfrontPercent: z.number().min(0).max(100).nullable().optional(),
  dueAfterDays: z.number().int().nonnegative().nullable().optional(),
  dueAfterPercent: z.number().min(0).max(100).nullable().optional(),
  maxInvitations: z.number().int().nonnegative().default(0),
  freePtSessions: z.number().int().nonnegative().default(0),
  commissionable: z.boolean().optional(),
  commissionMilestones: z.number().int().positive().default(1),
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

