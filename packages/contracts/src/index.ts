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
  code: z.string().min(1),
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export type CreateMemberDto = z.infer<typeof CreateMemberSchema>;

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
// Common DTOs
// ---------------------------------------------------------------------------

export const HealthCheckResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
  uptime: z.number(),
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

