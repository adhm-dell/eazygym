import { describe, expect, it } from "vitest";
import { canCloseShift, expectedCash, expiryDedupeKey, nextExpiryReminder, requireOpenShift, shiftVariance, toMinor } from "..";

describe("shift cash", () => {
  it("expenses and disbursements reduce expected cash; instapay/card/wallet never enter", () => {
    const e = expectedCash({
      openingCash: toMinor(500), cashPayments: toMinor(2000), cashReceiptVouchers: toMinor(300),
      expensesFromDrawer: toMinor(150), cashDisbursementVouchers: toMinor(100),
    });
    expect(e).toBe(toMinor(2550));
    expect(shiftVariance(e, toMinor(2500))).toBe(toMinor(-50));
  });
  it("staff closes only their own shift; admin closes any", () => {
    const s = { shiftStatus: "OPEN" as const, shiftOwnerId: "a" };
    expect(canCloseShift({ ...s, actorId: "a", actorIsAdmin: false })).toBe("OK");
    expect(canCloseShift({ ...s, actorId: "b", actorIsAdmin: false })).toBe("NOT_OWNER");
    expect(canCloseShift({ ...s, actorId: "b", actorIsAdmin: true })).toBe("OK");
    expect(canCloseShift({ shiftStatus: "CLOSED", shiftOwnerId: "a", actorId: "a", actorIsAdmin: true })).toBe("ALREADY_CLOSED");
  });
  it("rejects cash records without an open shift", () => {
    expect(() => requireOpenShift(null)).toThrow("NO_OPEN_SHIFT");
    expect(() => requireOpenShift({ status: "CLOSED" as const })).toThrow("NO_OPEN_SHIFT");
    expect(requireOpenShift({ status: "OPEN" as const }).status).toBe("OPEN");
  });
});

describe("expiry reminders", () => {
  const end = new Date("2026-06-20T00:00:00Z");
  const run = (iso: string, sent: number[] = []) =>
    nextExpiryReminder({ endDate: end, now: new Date(iso), thresholds: [7, 3, 1], alreadySent: sent });
  it("sends one reminder per threshold", () => {
    expect(run("2026-06-10T00:00:00Z")).toBeNull();
    expect(run("2026-06-13T00:00:00Z")).toBe(7);
    expect(run("2026-06-13T00:00:00Z", [7])).toBeNull();
    expect(run("2026-06-17T00:00:00Z", [7])).toBe(3);
    expect(run("2026-06-19T00:00:00Z", [7, 3])).toBe(1);
  });
  it("does not spam old thresholds if the job was down", () => {
    expect(run("2026-06-19T12:00:00Z")).toBe(1);
  });
  it("nothing after expiry; stable dedupe key", () => {
    expect(run("2026-06-21T00:00:00Z")).toBeNull();
    expect(expiryDedupeKey("s1", 3)).toBe("sub-expiring:s1:3");
  });
});
