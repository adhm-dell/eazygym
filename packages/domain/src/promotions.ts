import { type Minor, allocateProRata, percentOf } from "./money";

export type ItemKind = "SUBSCRIPTION" | "SERVICE" | "PRODUCT";

export interface PromotionRule {
  type: "PERCENT" | "FIXED";
  value: Minor | number; // PERCENT: 0..100, FIXED: minor units
  maxDiscount?: Minor | null;
  minSubtotal?: Minor | null;
  itemKinds: ItemKind[]; // empty = all kinds
  planIds: string[]; // empty = all plans
  startsAt?: Date | null;
  endsAt?: Date | null;
  maxUses?: number | null;
  perMemberLimit?: number | null;
  isActive: boolean;
  code?: string | null;
}

export interface CartItem {
  id: string;
  kind: ItemKind;
  planId?: string | null;
  total: Minor; // before discount
}

export type PromotionDenial =
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "WRONG_CODE"
  | "MAX_USES_REACHED"
  | "MEMBER_LIMIT_REACHED"
  | "NOTHING_ELIGIBLE"
  | "BELOW_MIN_SUBTOTAL";

export interface PromotionResult {
  applicable: boolean;
  reason?: PromotionDenial;
  discount: Minor;
  /** discount split across the eligible items (sums exactly to `discount`) */
  perItem: { id: string; discount: Minor }[];
}

const none = (reason: PromotionDenial): PromotionResult => ({ applicable: false, reason, discount: 0, perItem: [] });

/**
 * One promotion per invoice. The discount is computed on the ELIGIBLE items only
 * and split across them pro rata, so each subscription gets its own net price
 * (which is what commission and refunds are based on).
 */
export function evaluatePromotion(input: {
  promo: PromotionRule;
  items: CartItem[];
  now: Date;
  enteredCode?: string | null;
  totalRedemptions: number;
  memberRedemptions: number;
}): PromotionResult {
  const { promo, now } = input;
  if (!promo.isActive) return none("INACTIVE");
  if (promo.startsAt && now < promo.startsAt) return none("NOT_STARTED");
  if (promo.endsAt && now > promo.endsAt) return none("EXPIRED");
  if (promo.code && promo.code.trim().toLowerCase() !== (input.enteredCode ?? "").trim().toLowerCase()) {
    return none("WRONG_CODE");
  }
  if (promo.maxUses != null && input.totalRedemptions >= promo.maxUses) return none("MAX_USES_REACHED");
  if (promo.perMemberLimit != null && input.memberRedemptions >= promo.perMemberLimit) {
    return none("MEMBER_LIMIT_REACHED");
  }

  const eligible = input.items.filter(
    (i) =>
      (promo.itemKinds.length === 0 || promo.itemKinds.includes(i.kind)) &&
      (promo.planIds.length === 0 || i.kind !== "SUBSCRIPTION" || (i.planId != null && promo.planIds.includes(i.planId))),
  );
  const base = eligible.reduce((s, i) => s + i.total, 0);
  if (eligible.length === 0 || base <= 0) return none("NOTHING_ELIGIBLE");
  if (promo.minSubtotal != null && base < promo.minSubtotal) return none("BELOW_MIN_SUBTOTAL");

  let discount = promo.type === "PERCENT" ? percentOf(base, Number(promo.value)) : Number(promo.value);
  if (promo.type === "PERCENT" && promo.maxDiscount != null) discount = Math.min(discount, promo.maxDiscount);
  discount = Math.min(discount, base); // never below zero

  const parts = allocateProRata(discount, eligible.map((i) => i.total));
  return { applicable: true, discount, perItem: eligible.map((i, n) => ({ id: i.id, discount: parts[n] ?? 0 })) };
}

/** Manual discount (no promotion): needs a note, cannot exceed the subtotal. */
export function validateManualDiscount(input: { subtotal: Minor; discount: Minor; note?: string | null }): "OK" | "NOTE_REQUIRED" | "EXCEEDS_SUBTOTAL" | "NEGATIVE" {
  if (input.discount < 0) return "NEGATIVE";
  if (input.discount > input.subtotal) return "EXCEEDS_SUBTOTAL";
  if (input.discount > 0 && !(input.note ?? "").trim()) return "NOTE_REQUIRED";
  return "OK";
}
