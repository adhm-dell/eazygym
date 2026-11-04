import { type Minor, percentOf } from "./money";
import { addDays } from "./time";

export interface PaymentLike {
  amount: Minor; // positive = money in, negative = refund
}

export const collectedTotal = (payments: PaymentLike[]): Minor =>
  payments.reduce((s, p) => s + p.amount, 0);

export const remainingAmount = (total: Minor, collected: Minor): Minor => Math.max(0, total - collected);

// ---------------------------------------------------------------------------
// Activation: "if he did not pay at least X% the subscription is not created"
// ---------------------------------------------------------------------------
export interface ActivationResult {
  canActivate: boolean;
  requiredMinimum: Minor;
  shortfall: Minor;
}

export function activationDecision(input: {
  total: Minor;
  collected: Minor;
  minUpfrontPercent: number; // 0..100
}): ActivationResult {
  const required = Math.ceil((input.total * input.minUpfrontPercent) / 100);
  const shortfall = Math.max(0, required - input.collected);
  return { canActivate: shortfall === 0, requiredMinimum: required, shortfall };
}

// ---------------------------------------------------------------------------
// Overdue: "after N days / half of the period without paying the rest -> suspended"
// ---------------------------------------------------------------------------
export interface DuePolicy {
  dueAfterDays?: number | null;
  /** % of the subscription duration (50 = half of the period). */
  dueAfterPercent?: number | null;
}

/** Date after which an unpaid balance suspends the subscription, or null = never. */
export function balanceDueDate(input: { startDate: Date; durationDays: number } & DuePolicy): Date | null {
  const candidates: Date[] = [];
  if (input.dueAfterDays != null) candidates.push(addDays(input.startDate, input.dueAfterDays));
  if (input.dueAfterPercent != null) {
    candidates.push(addDays(input.startDate, Math.round((input.durationDays * input.dueAfterPercent) / 100)));
  }
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

export function isOverdue(input: {
  total: Minor;
  collected: Minor;
  startDate: Date;
  durationDays: number;
  now: Date;
} & DuePolicy): boolean {
  if (remainingAmount(input.total, input.collected) === 0) return false;
  const due = balanceDueDate(input);
  return due !== null && input.now.getTime() >= due.getTime();
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

/** Auto-use of the member's wallet when buying: pay as much as the balance allows. */
export function planWalletUse(input: { balance: Minor; due: Minor; autoApply?: boolean }): {
  fromWallet: Minor;
  remainingDue: Minor;
} {
  if (input.autoApply === false || input.balance <= 0 || input.due <= 0) {
    return { fromWallet: 0, remainingDue: Math.max(0, input.due) };
  }
  const fromWallet = Math.min(input.balance, input.due);
  return { fromWallet, remainingDue: input.due - fromWallet };
}

/** Cash/other tendered above what is due is credited to the wallet (not given back as change). */
export function settleTender(input: { due: Minor; tendered: Minor }): { applied: Minor; walletCredit: Minor } {
  const applied = Math.min(input.due, input.tendered);
  return { applied, walletCredit: input.tendered - applied };
}

/** Wallet balance can never go negative. */
export function applyWalletDelta(balance: Minor, delta: Minor): Minor {
  const next = balance + delta;
  if (next < 0) throw new RangeError("INSUFFICIENT_WALLET_BALANCE");
  return next;
}

/** Split an invoice's collected money across its items proportionally (exact to the piaster). */
export { allocateProRata as allocateAcrossItems } from "./money";

export { percentOf };
