import { describe, expect, it } from "vitest";
import {
  TierConfigError, allocateCollected, buildMilestones, monthlyCommission, pickTier,
  shiftPendingMilestones, splitOnTransfer, toMinor,
} from "..";

const d = (s: string) => new Date(s);

describe("milestones", () => {
  it("3000 over 3 months => 3 x 1000, due monthly", () => {
    const ms = buildMilestones({ price: toMinor(3000), milestones: 3, startDate: d("2026-01-01T00:00:00Z"), durationDays: 90 });
    expect(ms.map((m) => m.base)).toEqual([toMinor(1000), toMinor(1000), toMinor(1000)]);
    expect(ms.map((m) => m.dueDate.toISOString().slice(0, 10))).toEqual(["2026-01-31", "2026-03-02", "2026-04-01"]);
    expect(ms[1]!.periodStart.getTime()).toBe(ms[0]!.dueDate.getTime());
  });
  it("remainder goes to the last slice and the sum is exact", () => {
    const ms = buildMilestones({ price: 1000_01, milestones: 3, startDate: d("2026-01-01T00:00:00Z"), durationDays: 90 });
    expect(ms.reduce((s, m) => s + m.base, 0)).toBe(1000_01);
  });
  it("freeze pushes only the pending milestones", () => {
    const ms = buildMilestones({ price: 3000_00, milestones: 3, startDate: d("2026-01-01T00:00:00Z"), durationDays: 90 });
    const shifted = shiftPendingMilestones(ms, d("2026-02-10T00:00:00Z"), 10);
    expect(shifted[0]!.dueDate.getTime()).toBe(ms[0]!.dueDate.getTime());
    expect(shifted[1]!.dueDate.getTime()).toBe(ms[1]!.dueDate.getTime() + 10 * 86_400_000);
  });
});

describe("collected money fills milestones in order", () => {
  const ms = [{ base: 1000_00 }, { base: 1000_00 }, { base: 1000_00 }];
  it("partial payment", () => expect(allocateCollected(1500_00, ms)).toEqual([1000_00, 500_00, 0]));
  it("fully paid / unpaid / overpaid", () => {
    expect(allocateCollected(3000_00, ms)).toEqual([1000_00, 1000_00, 1000_00]);
    expect(allocateCollected(0, ms)).toEqual([0, 0, 0]);
    expect(allocateCollected(9000_00, ms)).toEqual([1000_00, 1000_00, 1000_00]);
  });
  it("a refund shrinks the last milestones first", () => {
    expect(allocateCollected(1200_00, ms)).toEqual([1000_00, 200_00, 0]);
  });
});

describe("tiers", () => {
  const tiers = [{ minRevenue: 0, percent: 40 }, { minRevenue: toMinor(10000), percent: 50 }];
  it("picks by collected revenue, applied to the whole month", () => {
    expect(pickTier(tiers, toMinor(9999.99)).percent).toBe(40);
    expect(pickTier(tiers, toMinor(10000)).percent).toBe(50);
  });
  it("refuses a silent default", () => {
    expect(() => pickTier([], 0)).toThrow(TierConfigError);
    expect(() => pickTier([{ minRevenue: 100, percent: 50 }], 0)).toThrow("TIERS_MUST_START_AT_ZERO");
  });
  it("1000 milestone at 50% = 500 (your example)", () => {
    const r = monthlyCommission({ entries: [{ allocatedBase: toMinor(1000), shareBps: 10_000 }], tier: { minRevenue: 0, percent: 50 } });
    expect(r.commission).toBe(toMinor(500));
  });
  it("partially collected milestone pays proportionally", () => {
    const r = monthlyCommission({ entries: [{ allocatedBase: toMinor(500), shareBps: 10_000 }], tier: { minRevenue: 0, percent: 50 } });
    expect(r.commission).toBe(toMinor(250));
  });
  it("respects the coach share after a transfer", () => {
    const r = monthlyCommission({ entries: [{ allocatedBase: toMinor(1000), shareBps: 3_000 }], tier: { minRevenue: 0, percent: 50 } });
    expect(r.commission).toBe(toMinor(150));
  });
});

describe("coach transfer (by days)", () => {
  const ms = buildMilestones({ price: toMinor(3000), milestones: 3, startDate: d("2026-01-01T00:00:00Z"), durationDays: 90 })
    .map((m) => ({ index: m.index, periodStart: m.periodStart, dueDate: m.dueDate, heldBps: 10_000 }));

  it("past milestones stay with the old coach, future ones move, current one is split", () => {
    // 15 days into milestone 2 (starts 2026-01-31, 30 days long)
    const r = splitOnTransfer(ms, d("2026-02-15T00:00:00Z"));
    expect(r[0]).toEqual({ index: 1, oldKeepsBps: 10_000, newGetsBps: 0 });
    expect(r[1]!.oldKeepsBps).toBe(5_000);
    expect(r[1]!.newGetsBps).toBe(5_000);
    expect(r[2]).toEqual({ index: 3, oldKeepsBps: 0, newGetsBps: 10_000 });
  });
  it("transfer on day 0 of the subscription moves everything", () => {
    const r = splitOnTransfer(ms, d("2026-01-01T00:00:00Z"));
    expect(r.every((x) => x.oldKeepsBps === 0 && x.newGetsBps === 10_000)).toBe(true);
  });
  it("second transfer inside the same milestone: earlier coach's part is not double counted", () => {
    // A held [0..50%] (took 5000), B holds 5000 and is replaced at 75% of the period
    const held = [{ index: 2, periodStart: ms[1]!.periodStart, dueDate: ms[1]!.dueDate, heldBps: 5_000 }];
    const total = Math.round((ms[1]!.dueDate.getTime() - ms[1]!.periodStart.getTime()) / 86_400_000);
    const t = new Date(ms[1]!.periodStart.getTime() + Math.round(total * 0.75) * 86_400_000);
    const r = splitOnTransfer(held, t)[0]!;
    expect(r.oldKeepsBps).toBeGreaterThan(2_300);
    expect(r.oldKeepsBps).toBeLessThan(2_700);
    expect(r.oldKeepsBps + r.newGetsBps).toBe(5_000);
  });
});
