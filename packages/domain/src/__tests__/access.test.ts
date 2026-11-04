import { describe, expect, it } from "vitest";
import { type AccessSubscription, evaluateAccess } from "..";

const base: AccessSubscription = {
  id: "s1", kind: "GYM", grantsFloorAccess: true,
  startDate: new Date("2026-01-01T00:00:00Z"), endDate: new Date("2026-12-31T00:00:00Z"),
  cancelled: false, activated: true, frozen: false, overdue: false, sessionsLeft: null,
};
const now = new Date("2026-06-10T10:00:00Z"); // Wednesday
const run = (subs: AccessSubscription[], blocked = false, at = now) =>
  evaluateAccess({ isBlocked: blocked, subscriptions: subs }, at, { timeZone: "UTC" });

describe("evaluateAccess - gym", () => {
  it("allows an active member", () => {
    const r = run([base]);
    expect(r).toMatchObject({ allowed: true, reason: "ACTIVE", subscriptionId: "s1" });
  });
  it("flags expiring soon", () => {
    const r = run([{ ...base, endDate: new Date("2026-06-13T00:00:00Z") }]);
    expect(r.allowed && r.expiringSoon).toBe(true);
  });
  it("denies: blocked / none / expired / frozen / overdue / pending / not started / cancelled", () => {
    expect(run([base], true).reason).toBe("BLOCKED");
    expect(run([]).reason).toBe("NO_SUBSCRIPTION");
    expect(run([{ ...base, endDate: new Date("2026-06-01T00:00:00Z") }]).reason).toBe("EXPIRED");
    expect(run([{ ...base, frozen: true }]).reason).toBe("FROZEN");
    expect(run([{ ...base, overdue: true }]).reason).toBe("PAYMENT_OVERDUE");
    expect(run([{ ...base, activated: false }]).reason).toBe("PENDING_PAYMENT");
    expect(run([{ ...base, startDate: new Date("2026-07-01T00:00:00Z") }]).reason).toBe("NOT_STARTED");
    expect(run([{ ...base, cancelled: true }]).reason).toBe("CANCELLED");
  });
  it("frozen member whose original end date passed is FROZEN, not EXPIRED", () => {
    expect(run([{ ...base, frozen: true, endDate: new Date("2026-06-01T00:00:00Z") }]).reason).toBe("FROZEN");
  });
  it("PT-only expired is reported as PT_EXPIRED", () => {
    const pt: AccessSubscription = { ...base, id: "p1", kind: "PT", grantsFloorAccess: false, endDate: new Date("2026-06-01T00:00:00Z") };
    expect(run([pt]).reason).toBe("PT_EXPIRED");
  });
  it("PT with no floor access flag is denied even if active", () => {
    expect(run([{ ...base, kind: "PT", grantsFloorAccess: false }]).reason).toBe("NO_FLOOR_ACCESS");
  });
  it("gym + PT: gym opens the door even when PT expired", () => {
    const pt: AccessSubscription = { ...base, id: "p1", kind: "PT", grantsFloorAccess: false, endDate: new Date("2026-06-01T00:00:00Z") };
    expect(run([pt, base]).subscriptionId).toBe("s1");
  });
  it("PT sessions finished -> denied for that sub", () => {
    expect(run([{ ...base, sessionsLeft: 0 }]).reason).toBe("NO_SESSIONS_LEFT");
  });
});

describe("evaluateAccess - class only, SCHEDULED mode (Wed 18:00-19:00)", () => {
  const cls: AccessSubscription = {
    ...base, id: "c1", kind: "CLASS",
    classSlots: [{ id: "k1", dayOfWeek: 3, startMinutes: 18 * 60, endMinutes: 19 * 60 }],
  };
  const at = (iso: string) => new Date(iso);
  const sched = (subs: AccessSubscription[], when: string, extra = {}) =>
    evaluateAccess({ isBlocked: false, subscriptions: subs }, at(when), { timeZone: "UTC", classEntryMode: "SCHEDULED", ...extra });

  it("allows during the class", () => expect(sched([cls], "2026-06-10T18:30:00Z").allowed).toBe(true));
  it("denies before / after the class on session day", () => {
    expect(sched([cls], "2026-06-10T17:00:00Z").reason).toBe("CLASS_OUT_OF_TIME");
    expect(sched([cls], "2026-06-10T19:30:00Z").reason).toBe("CLASS_OUT_OF_TIME");
  });
  it("denies on a non-session day", () => expect(sched([cls], "2026-06-11T18:30:00Z").reason).toBe("CLASS_NOT_TODAY"));
  it("respects early check-in minutes", () => expect(sched([cls], "2026-06-10T17:45:00Z", { classEarlyMinutes: 15 }).allowed).toBe(true));
  it("uses the gym timezone (Cairo is UTC+3 in summer)", () => {
    expect(sched([cls], "2026-06-10T15:30:00Z", { timeZone: "Africa/Cairo" }).allowed).toBe(true);
  });
});

describe("evaluateAccess - class only, RECEPTION_STARTS mode (default)", () => {
  const slot = { id: "k1", dayOfWeek: 3, startMinutes: 18 * 60, endMinutes: 19 * 60 };
  const mk = (patch: Partial<typeof slot> & Record<string, unknown> = {}): AccessSubscription => ({
    ...base, id: "c1", kind: "CLASS", classSlots: [{ ...slot, ...patch }],
  });
  const at = (iso: string) => new Date(iso);
  const run = (sub: AccessSubscription, when: string) =>
    evaluateAccess({ isBlocked: false, subscriptions: [sub] }, at(when), { timeZone: "UTC" });

  it("denies at the scheduled time until reception starts the class (coach is late)", () => {
    expect(run(mk(), "2026-06-10T18:05:00Z").reason).toBe("CLASS_NOT_STARTED");
  });
  it("allows once reception started it - even if that is after the scheduled start", () => {
    const sub = mk({ todayRun: { startedAt: at("2026-06-10T18:20:00Z") } });
    expect(run(sub, "2026-06-10T18:25:00Z").allowed).toBe(true);
  });
  it("denies a scan before the actual start time", () => {
    const sub = mk({ todayRun: { startedAt: at("2026-06-10T18:20:00Z") } });
    expect(run(sub, "2026-06-10T18:10:00Z").allowed).toBe(false);
  });
  it("a late start keeps the full class length (starts 18:20 -> open until 19:20)", () => {
    const sub = mk({ todayRun: { startedAt: at("2026-06-10T18:20:00Z") } });
    expect(run(sub, "2026-06-10T19:15:00Z").allowed).toBe(true);
    expect(run(sub, "2026-06-10T19:25:00Z").reason).toBe("CLASS_ENDED");
  });
  it("reception can end the class early", () => {
    const sub = mk({ todayRun: { startedAt: at("2026-06-10T18:00:00Z"), endedAt: at("2026-06-10T18:40:00Z") } });
    expect(run(sub, "2026-06-10T18:30:00Z").allowed).toBe(true);
    expect(run(sub, "2026-06-10T18:45:00Z").reason).toBe("CLASS_ENDED");
  });
  it("not the member's day -> CLASS_NOT_TODAY; cancelled -> CLASS_CANCELLED", () => {
    expect(run(mk(), "2026-06-11T18:30:00Z").reason).toBe("CLASS_NOT_TODAY");
    expect(run(mk({ todayCancelled: true }), "2026-06-10T18:30:00Z").reason).toBe("CLASS_CANCELLED");
  });
  it("rescheduled class uses its new length", () => {
    const sub = mk({ todayStartMinutes: 20 * 60, todayEndMinutes: 20 * 60 + 30, todayRun: { startedAt: at("2026-06-10T20:00:00Z") } });
    expect(run(sub, "2026-06-10T20:20:00Z").allowed).toBe(true);
    expect(run(sub, "2026-06-10T20:40:00Z").reason).toBe("CLASS_ENDED");
  });
});
