import type { Minor } from "@gym/domain";

export type StaffRole = "SUPER_ADMIN" | "GYM_ADMIN" | "RECEPTION" | "BAR_CASHIER" | "COACH";
export type PlanKind = "GYM" | "PT" | "CLASS";
export type SubscriptionStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "FROZEN"
  | "SUSPENDED_UNPAID"
  | "EXPIRED"
  | "CANCELLED";
export type PaymentMethod = "CASH" | "INSTAPAY" | "CARD" | "WALLET";
export type InvoiceStatus = "OPEN" | "PAID" | "VOID";
export type WalletTxType = "TOPUP" | "OVERPAYMENT" | "PURCHASE" | "REFUND" | "PAYOUT" | "ADJUSTMENT";
export type ShiftStatus = "OPEN" | "CLOSED";

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
  freezeMaxCount: number;
  freezeMaxTotalDays: number;
  minUpfrontPercent: number | null;
  dueAfterDays: number | null;
  dueAfterPercent: number | null;
  commissionable: boolean;
  commissionMilestones: number;
  isActive: boolean;
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
  sessionsLeft?: number | null;
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

export interface Wallet {
  id: string;
  gymId: string;
  memberId: string;
  balance: Minor;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  gymId: string;
  walletId: string;
  type: WalletTxType;
  amount: Minor;
  balanceAfter: Minor;
  paymentId: string | null;
  voucherId: string | null;
  note: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface Shift {
  id: string;
  gymId: string;
  staffId: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openingCash: Minor;
  expectedCash: Minor | null;
  countedCash: Minor | null;
  variance: Minor | null;
  note: string | null;
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

export interface ClassSchedule {
  id: string;
  gymId: string;
  name: string;
  coachId: string;
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startTime: string; // "18:00"
  endTime: string; // "19:00"
  capacity: number;
  isActive: boolean;
}

export interface ClassScheduleException {
  id: string;
  classScheduleId: string;
  date: string;
  isCancelled: boolean;
  newStartTime?: string | null;
  newEndTime?: string | null;
  substituteCoachId?: string | null;
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

export interface SubscriptionClassSlot {
  id: string;
  subscriptionId: string;
  classScheduleId: string;
}

export interface ClassScheduleWithDetails extends ClassSchedule {
  coachName: string;
  enrolledMembersCount: number;
  todaySession: ClassSession | null;
  isCancelledToday: boolean;
  effectiveStartTime: string;
  effectiveEndTime: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "ENDED" | "CANCELLED";
}

// ---------------------------------------------------------------------------
// POS, Catalog, Promotions & Vouchers
// ---------------------------------------------------------------------------

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
  value: Minor; // percent (0-100) or fixed minor units
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

export type VoucherType = "RECEIPT" | "DISBURSEMENT";

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

export interface PaymentAllocation {
  id: string;
  gymId: string;
  paymentId: string;
  invoiceItemId: string;
  amount: Minor;
  coachId: string | null;
  createdAt: string;
}

export interface CreateInvoiceItemDto {
  kind: "SUBSCRIPTION" | "SERVICE" | "PRODUCT";
  planId?: string;
  serviceId?: string;
  productId?: string;
  quantity: number;
  unitPrice?: Minor;
  subscription?: {
    startDate?: string;
    coachId?: string;
    classSlotIds?: string[];
    freezeMaxCount?: number;
    freezeMaxTotalDays?: number;
  };
}

export interface CreateInvoiceDto {
  memberId?: string | null;
  items: CreateInvoiceItemDto[];
  promotionCode?: string | null;
  promotionId?: string | null;
  manualDiscount?: {
    amount: Minor;
    note: string;
  } | null;
  payments: {
    method: PaymentMethod;
    amount: Minor;
    reference?: string | null;
  }[];
  useWallet?: boolean;
  note?: string | null;
}

export interface CollectPaymentDto {
  payments: {
    method: PaymentMethod;
    amount: Minor;
    reference?: string | null;
  }[];
}

export interface CreateVoucherDto {
  type: VoucherType;
  memberId?: string | null;
  method: "CASH" | "INSTAPAY" | "CARD";
  amount: Minor;
  reason: string;
  creditToWallet?: boolean;
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
}


