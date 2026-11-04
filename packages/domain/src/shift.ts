import { type Minor } from "./money";

export interface ShiftCashTotals {
  openingCash: Minor;
  // cash IN (drawer)
  cashPayments: Minor; // invoice payments by CASH (net of cash refunds)
  cashReceiptVouchers: Minor; // سند قبض نقدي
  // cash OUT (drawer)
  expensesFromDrawer: Minor; // operational expenses paid from the reception
  cashDisbursementVouchers: Minor; // سند صرف نقدي
}

/** What should physically be in the drawer. Instapay / card / wallet never enter this number. */
export const expectedCash = (t: ShiftCashTotals): Minor =>
  t.openingCash + t.cashPayments + t.cashReceiptVouchers - t.expensesFromDrawer - t.cashDisbursementVouchers;

/** counted - expected: negative = shortage, positive = overage. */
export const shiftVariance = (expected: Minor, counted: Minor): Minor => counted - expected;

export type ShiftCloseDenial = "ALREADY_CLOSED" | "NOT_OWNER" | "OK";

/**
 * A staff member closes only his own shift. Admins may close any shift
 * (single or "close all"); the actor is recorded in Shift.closedById.
 */
export function canCloseShift(input: {
  shiftStatus: "OPEN" | "CLOSED";
  shiftOwnerId: string;
  actorId: string;
  actorIsAdmin: boolean;
}): ShiftCloseDenial {
  if (input.shiftStatus === "CLOSED") return "ALREADY_CLOSED";
  if (input.actorIsAdmin || input.actorId === input.shiftOwnerId) return "OK";
  return "NOT_OWNER";
}

/** Cash-affecting records are rejected when the staff member has no open shift. */
export const requireOpenShift = <T extends { status: "OPEN" | "CLOSED" }>(shift: T | null | undefined): T => {
  if (!shift || shift.status !== "OPEN") throw new Error("NO_OPEN_SHIFT");
  return shift;
};
