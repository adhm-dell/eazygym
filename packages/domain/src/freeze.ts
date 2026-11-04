import { addDays, diffDaysCeil } from "./time";

export type FreezeDenial =
  | "FREEZE_NOT_ALLOWED"
  | "ALREADY_FROZEN"
  | "NOT_ACTIVE"
  | "PAYMENT_OVERDUE"
  | "COUNT_EXHAUSTED"
  | "DAYS_EXHAUSTED"
  | "REQUEST_EXCEEDS_REMAINING";

export interface FreezeState {
  isFrozen: boolean;
  isActive: boolean; // started, not expired, not cancelled
  overdue: boolean;
  maxCount: number; // set by the admin when selling (e.g. 2)
  maxTotalDays: number; // e.g. 15
  usedCount: number;
  usedDays: number;
}

export interface FreezeDecision {
  ok: boolean;
  reason?: FreezeDenial;
  remainingCount: number;
  remainingDays: number;
}

/**
 * A freeze is allowed only while the member is paid up (overdue subscriptions
 * cannot be frozen) and within the per-subscription limits set by the admin.
 */
export function canFreeze(state: FreezeState, requestedDays?: number): FreezeDecision {
  const remainingCount = Math.max(0, state.maxCount - state.usedCount);
  const remainingDays = Math.max(0, state.maxTotalDays - state.usedDays);
  const deny = (reason: FreezeDenial): FreezeDecision => ({ ok: false, reason, remainingCount, remainingDays });

  if (state.maxCount <= 0 || state.maxTotalDays <= 0) return deny("FREEZE_NOT_ALLOWED");
  if (state.isFrozen) return deny("ALREADY_FROZEN");
  if (state.overdue) return deny("PAYMENT_OVERDUE");
  if (!state.isActive) return deny("NOT_ACTIVE");
  if (remainingCount === 0) return deny("COUNT_EXHAUSTED");
  if (remainingDays === 0) return deny("DAYS_EXHAUSTED");
  if (requestedDays !== undefined && requestedDays > remainingDays) return deny("REQUEST_EXCEEDS_REMAINING");
  return { ok: true, remainingCount, remainingDays };
}

/**
 * Days to add to the end date when a freeze ends: whole days elapsed, rounded
 * up, never more than the remaining allowance. Overflow days are NOT credited.
 */
export function settleFreeze(input: { startedAt: Date; endedAt: Date; remainingDays: number }): {
  days: number;
  overflowDays: number;
} {
  const elapsed = Math.max(0, diffDaysCeil(input.startedAt, input.endedAt));
  const days = Math.min(elapsed, Math.max(0, input.remainingDays));
  return { days, overflowDays: elapsed - days };
}

export const endDateAfterFreeze = (endDate: Date, freezeDays: number): Date => addDays(endDate, freezeDays);
