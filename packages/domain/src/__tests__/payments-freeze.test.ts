import { describe, expect, it } from "vitest";
import {
  activationDecision, applyWalletDelta, balanceDueDate, canFreeze, endDateAfterFreeze,
  isOverdue, planWalletUse, settleFreeze, settleTender, toMinor,
} from "..";

const d = (s: string) => new Date(s);

describe("activation (min upfront %)", () => {
  it("rejects below 50% and reports the shortfall", () => {
    const r = activationDecision({ total: toMinor(3000), collected: toMinor(1400), minUpfrontPercent: 50 });
    expect(r.canActivate).toBe(false);
    expect(r.requiredMinimum).toBe(toMinor(1500));
    expect(r.shortfall).toBe(toMinor(100));
  });
  it("accepts exactly 50%", () => {
    expect(activationDecision({ total: toMinor(3000), collected: toMinor(1500), minUpfrontPercent: 50 }).canActivate).toBe(true);
  });
  it("0% means anything goes", () => {
    expect(activationDecision({ total: 1000, collected: 0, minUpfrontPercent: 0 }).canActivate).toBe(true);
  });
});

describe("overdue balance", () => {
  const base = { total: toMinor(3000), startDate: d("2026-01-01T00:00:00Z"), durationDays: 90 };
  it("is not overdue when fully paid", () => {
    expect(isOverdue({ ...base, collected: toMinor(3000), now: d("2026-06-01T00:00:00Z"), dueAfterDays: 10 })).toBe(false);
  });
  it("is overdue after N days with a balance", () => {
    expect(isOverdue({ ...base, collected: toMinor(1500), now: d("2026-01-11T00:00:00Z"), dueAfterDays: 10 })).toBe(true);
    expect(isOverdue({ ...base, collected: toMinor(1500), now: d("2026-01-10T23:00:00Z"), dueAfterDays: 10 })).toBe(false);
  });
  it("supports 'half of the period'", () => {
    const due = balanceDueDate({ startDate: base.startDate, durationDays: 90, dueAfterPercent: 50 })!;
    expect(due.toISOString()).toBe("2026-02-15T00:00:00.000Z");
  });
  it("takes the earliest of days / percent", () => {
    const due = balanceDueDate({ startDate: base.startDate, durationDays: 90, dueAfterDays: 20, dueAfterPercent: 50 })!;
    expect(due.toISOString()).toBe("2026-01-21T00:00:00.000Z");
  });
  it("no policy = never overdue", () => {
    expect(isOverdue({ ...base, collected: 0, now: d("2030-01-01T00:00:00Z") })).toBe(false);
  });
});

describe("wallet", () => {
  it("auto-applies up to the balance", () => {
    expect(planWalletUse({ balance: toMinor(500), due: toMinor(800) })).toEqual({ fromWallet: toMinor(500), remainingDue: toMinor(300) });
    expect(planWalletUse({ balance: toMinor(900), due: toMinor(800) })).toEqual({ fromWallet: toMinor(800), remainingDue: 0 });
  });
  it("can be disabled", () => {
    expect(planWalletUse({ balance: 1000, due: 800, autoApply: false }).fromWallet).toBe(0);
  });
  it("credits the excess to the wallet", () => {
    expect(settleTender({ due: toMinor(800), tendered: toMinor(1000) })).toEqual({ applied: toMinor(800), walletCredit: toMinor(200) });
  });
  it("never goes negative", () => {
    expect(() => applyWalletDelta(100, -200)).toThrow("INSUFFICIENT_WALLET_BALANCE");
    expect(applyWalletDelta(100, -100)).toBe(0);
  });
});

describe("freeze (15 days over 2 times)", () => {
  const st = { isFrozen: false, isActive: true, overdue: false, maxCount: 2, maxTotalDays: 15, usedCount: 0, usedDays: 0 };
  it("allows within limits", () => expect(canFreeze(st, 10).ok).toBe(true));
  it("blocks a request above the remaining days", () => {
    expect(canFreeze({ ...st, usedCount: 1, usedDays: 10 }, 6).reason).toBe("REQUEST_EXCEEDS_REMAINING");
  });
  it("blocks when count exhausted", () => {
    expect(canFreeze({ ...st, usedCount: 2, usedDays: 5 }).reason).toBe("COUNT_EXHAUSTED");
  });
  it("blocks when days exhausted", () => {
    expect(canFreeze({ ...st, usedCount: 1, usedDays: 15 }).reason).toBe("DAYS_EXHAUSTED");
  });
  it("blocks overdue members and plans without freeze", () => {
    expect(canFreeze({ ...st, overdue: true }).reason).toBe("PAYMENT_OVERDUE");
    expect(canFreeze({ ...st, maxCount: 0 }).reason).toBe("FREEZE_NOT_ALLOWED");
  });
  it("settles days and extends the end date; overflow is lost", () => {
    const r = settleFreeze({ startedAt: d("2026-03-01T00:00:00Z"), endedAt: d("2026-03-13T06:00:00Z"), remainingDays: 10 });
    expect(r).toEqual({ days: 10, overflowDays: 3 });
    expect(endDateAfterFreeze(d("2026-04-01T00:00:00Z"), r.days).toISOString()).toBe("2026-04-11T00:00:00.000Z");
  });
});
