import { type Minor, allocateProRata, bpsOf, percentOf, splitEvenly } from "./money";
import { DAY_MS, addDays } from "./time";

export interface Milestone {
  index: number; // 1-based
  periodStart: Date;
  dueDate: Date; // end of the period; the milestone is earned from this moment
  base: Minor; // price slice
}

/**
 * 3000 for 3 months => 3 milestones of 1000, due after month 1, 2, 3.
 * The remainder (if any) goes to the last milestone so the slices add up exactly.
 */
export function buildMilestones(input: {
  price: Minor;
  milestones: number;
  startDate: Date;
  durationDays: number;
}): Milestone[] {
  const slices = splitEvenly(input.price, input.milestones);
  const boundary = (i: number) => addDays(input.startDate, Math.round((input.durationDays * i) / input.milestones));
  return slices.map((base, i) => ({
    index: i + 1,
    periodStart: boundary(i),
    dueDate: boundary(i + 1),
    base,
  }));
}

/**
 * Collected money fills the milestones in order (waterfall):
 * collected 1500 on 3 x 1000 => [1000, 500, 0]. A late payment or a refund just
 * changes `collected` and the allocation is recomputed (idempotent).
 */
export function allocateCollected(collected: Minor, milestones: { base: Minor }[]): Minor[] {
  let cumulative = 0;
  let prevCovered = 0;
  return milestones.map((m) => {
    cumulative += m.base;
    const covered = Math.min(Math.max(0, collected), cumulative);
    const slice = covered - prevCovered;
    prevCovered = covered;
    return slice;
  });
}

/** A freeze pushes every not-yet-due milestone forward by the frozen days. */
export function shiftPendingMilestones<T extends { dueDate: Date; periodStart: Date }>(
  milestones: T[],
  now: Date,
  freezeDays: number,
): T[] {
  return milestones.map((m) =>
    m.dueDate.getTime() > now.getTime()
      ? { ...m, dueDate: addDays(m.dueDate, freezeDays), periodStart: m.periodStart.getTime() > now.getTime() ? addDays(m.periodStart, freezeDays) : m.periodStart }
      : m,
  );
}

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------
export interface Tier {
  minRevenue: Minor;
  percent: number;
}

export class TierConfigError extends Error {}

/** Tiers must start at 0 so there is never an implicit default percent. */
export function validateTiers(tiers: Tier[]): void {
  if (tiers.length === 0) throw new TierConfigError("NO_TIERS_CONFIGURED");
  if (!tiers.some((t) => t.minRevenue === 0)) throw new TierConfigError("TIERS_MUST_START_AT_ZERO");
  const seen = new Set<number>();
  for (const t of tiers) {
    if (seen.has(t.minRevenue)) throw new TierConfigError("DUPLICATE_TIER_THRESHOLD");
    seen.add(t.minRevenue);
    if (t.percent < 0 || t.percent > 100) throw new TierConfigError("PERCENT_OUT_OF_RANGE");
  }
}

/** Highest tier whose threshold <= collected revenue. The percent applies to the WHOLE month. */
export function pickTier(tiers: Tier[], collectedRevenue: Minor): Tier {
  validateTiers(tiers);
  const sorted = [...tiers].sort((a, b) => a.minRevenue - b.minRevenue);
  let chosen = sorted[0]!;
  for (const t of sorted) if (collectedRevenue >= t.minRevenue) chosen = t;
  return chosen;
}

/** Commission for one coach for one month. */
export function monthlyCommission(input: {
  entries: { allocatedBase: Minor; shareBps: number }[];
  tier: Tier;
}): { commissionableBase: Minor; commission: Minor } {
  const commissionableBase = input.entries.reduce((s, e) => s + bpsOf(e.allocatedBase, e.shareBps), 0);
  return { commissionableBase, commission: percentOf(commissionableBase, input.tier.percent) };
}

// ---------------------------------------------------------------------------
// Coach transfer (split by DAYS)
// ---------------------------------------------------------------------------
export interface HeldMilestone {
  index: number;
  periodStart: Date;
  dueDate: Date;
  /** share (bps) currently held by the coach being replaced */
  heldBps: number;
}

export interface TransferSplit {
  index: number;
  oldKeepsBps: number;
  newGetsBps: number;
}

/**
 * Old coach keeps what he earned until the transfer moment; the transfer day
 * itself belongs to the new coach.
 *  - milestone already due at transfer      -> old keeps everything he holds
 *  - milestone not started at transfer      -> everything moves to the new coach
 *  - milestone in progress                  -> split by elapsed days / period days
 * Earlier coaches in the same milestone hold the EARLIEST part of the period, so
 * the current holder's earned part is (elapsed fraction - what earlier coaches took).
 */
export function splitOnTransfer(milestones: HeldMilestone[], transferAt: Date): TransferSplit[] {
  return milestones.map((m) => {
    const held = m.heldBps;
    if (m.dueDate.getTime() <= transferAt.getTime()) {
      return { index: m.index, oldKeepsBps: held, newGetsBps: 0 };
    }
    if (m.periodStart.getTime() >= transferAt.getTime() && held === 10_000) {
      return { index: m.index, oldKeepsBps: 0, newGetsBps: held };
    }
    const totalDays = Math.max(1, Math.round((m.dueDate.getTime() - m.periodStart.getTime()) / DAY_MS));
    const elapsedDays = Math.min(totalDays, Math.max(0, Math.floor((transferAt.getTime() - m.periodStart.getTime()) / DAY_MS)));
    const elapsedBps = Math.round((elapsedDays / totalDays) * 10_000);
    const earlierTook = 10_000 - held;
    const oldKeeps = Math.min(held, Math.max(0, elapsedBps - earlierTook));
    return { index: m.index, oldKeepsBps: oldKeeps, newGetsBps: held - oldKeeps };
  });
}

export { allocateProRata };
