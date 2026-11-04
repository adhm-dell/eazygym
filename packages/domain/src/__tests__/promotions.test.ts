import { describe, expect, it } from "vitest";
import { type PromotionRule, evaluatePromotion, toMinor, validateManualDiscount } from "..";

const now = new Date("2026-06-10T10:00:00Z");
const promo = (p: Partial<PromotionRule> = {}): PromotionRule => ({
  type: "PERCENT", value: 10, itemKinds: [], planIds: [], isActive: true, ...p,
});
const items = [
  { id: "a", kind: "SUBSCRIPTION" as const, planId: "gym3", total: toMinor(3000) },
  { id: "b", kind: "SUBSCRIPTION" as const, planId: "pt3", total: toMinor(2000) },
  { id: "c", kind: "PRODUCT" as const, total: toMinor(100) },
];
const run = (p: PromotionRule, extra: Record<string, unknown> = {}) =>
  evaluatePromotion({ promo: p, items, now, totalRedemptions: 0, memberRedemptions: 0, ...extra });

describe("promotions", () => {
  it("10% on everything, split exactly across items", () => {
    const r = run(promo());
    expect(r.discount).toBe(toMinor(510));
    expect(r.perItem.reduce((s, x) => s + x.discount, 0)).toBe(r.discount);
    expect(r.perItem.find((x) => x.id === "a")!.discount).toBe(toMinor(300));
  });
  it("fixed amount is capped at the eligible total", () => {
    const r = evaluatePromotion({ promo: promo({ type: "FIXED", value: toMinor(500) }), items: [items[2]!], now, totalRedemptions: 0, memberRedemptions: 0 });
    expect(r.discount).toBe(toMinor(100));
  });
  it("percent cap", () => {
    expect(run(promo({ value: 50, maxDiscount: toMinor(400) })).discount).toBe(toMinor(400));
  });
  it("limited to specific plans / kinds", () => {
    const onlyGym = run(promo({ planIds: ["gym3"], itemKinds: ["SUBSCRIPTION"] }));
    expect(onlyGym.discount).toBe(toMinor(300));
    expect(onlyGym.perItem).toHaveLength(1);
  });
  it("date window", () => {
    expect(run(promo({ startsAt: new Date("2026-07-01T00:00:00Z") })).reason).toBe("NOT_STARTED");
    expect(run(promo({ endsAt: new Date("2026-06-01T00:00:00Z") })).reason).toBe("EXPIRED");
  });
  it("promo code (case-insensitive)", () => {
    expect(run(promo({ code: "SUMMER" })).reason).toBe("WRONG_CODE");
    expect(run(promo({ code: "SUMMER" }), { enteredCode: " summer " }).applicable).toBe(true);
  });
  it("usage limits", () => {
    expect(run(promo({ maxUses: 5 }), { totalRedemptions: 5 }).reason).toBe("MAX_USES_REACHED");
    expect(run(promo({ perMemberLimit: 1 }), { memberRedemptions: 1 }).reason).toBe("MEMBER_LIMIT_REACHED");
  });
  it("minimum subtotal / nothing eligible / inactive", () => {
    expect(run(promo({ minSubtotal: toMinor(9000) })).reason).toBe("BELOW_MIN_SUBTOTAL");
    expect(run(promo({ planIds: ["other"], itemKinds: ["SUBSCRIPTION"] })).reason).toBe("NOTHING_ELIGIBLE");
    expect(run(promo({ isActive: false })).reason).toBe("INACTIVE");
  });
  it("manual discount needs a note", () => {
    expect(validateManualDiscount({ subtotal: 1000, discount: 100 })).toBe("NOTE_REQUIRED");
    expect(validateManualDiscount({ subtotal: 1000, discount: 100, note: "friend" })).toBe("OK");
    expect(validateManualDiscount({ subtotal: 1000, discount: 2000, note: "x" })).toBe("EXCEEDS_SUBTOTAL");
  });
});
