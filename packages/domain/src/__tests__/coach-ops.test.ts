import { describe, expect, it } from "vitest";
import {
  canAddParticipant, canApproveBreak, canInviteVisitor, canRequestBreak, coachIdsOnShift, consumptionOnAttendance,
  countsTowardDailyLimit, initialBreakStatus, isBreakOverdue, isOnShift, moveToBack, recommendCoach, shouldNotifyOverdue,
} from "..";

const d = (s: string) => new Date(s);
const shift = (coachId: string, dayOfWeek: number, startTime: string, endTime: string, isActive = true) => ({ coachId, dayOfWeek, startTime, endTime, isActive });

describe("coach shifts", () => {
  const wedDay = [shift("a", 3, "09:00", "17:00")];
  it("inside / outside a normal shift (Wed 2026-06-10, UTC)", () => {
    expect(isOnShift(wedDay, d("2026-06-10T10:00:00Z"), "UTC")).toBe(true);
    expect(isOnShift(wedDay, d("2026-06-10T18:00:00Z"), "UTC")).toBe(false);
    expect(isOnShift(wedDay, d("2026-06-11T10:00:00Z"), "UTC")).toBe(false);
  });
  it("overnight shift covers both sides of midnight", () => {
    const night = [shift("a", 3, "21:00", "05:00")];
    expect(isOnShift(night, d("2026-06-10T22:00:00Z"), "UTC")).toBe(true); // Wed 22:00
    expect(isOnShift(night, d("2026-06-11T04:00:00Z"), "UTC")).toBe(true); // Thu 04:00
    expect(isOnShift(night, d("2026-06-11T06:00:00Z"), "UTC")).toBe(false);
    expect(isOnShift(night, d("2026-06-10T04:00:00Z"), "UTC")).toBe(false); // Wed early morning belongs to Tue's shift
  });
  it("inactive shifts are ignored; uses the gym timezone", () => {
    expect(isOnShift([shift("a", 3, "09:00", "17:00", false)], d("2026-06-10T10:00:00Z"), "UTC")).toBe(false);
    expect(isOnShift(wedDay, d("2026-06-10T06:30:00Z"), "Africa/Cairo")).toBe(true); // 09:30 Cairo
  });
  it("lists coaches on shift", () => {
    const all = [...wedDay, shift("b", 3, "18:00", "23:00")];
    expect(coachIdsOnShift(all, d("2026-06-10T10:00:00Z"), "UTC")).toEqual(["a"]);
  });
});

describe("coach breaks", () => {
  const ok = { requesterRole: "COACH" as const, requesterId: "c1", coachId: "c1", coachOnShift: true, coachHasActiveBreak: false, anotherCoachActiveBreak: false, breaksTodayCounted: 0, maxPerDay: 2 };
  it("who starts it decides the initial status", () => {
    expect(initialBreakStatus("COACH")).toBe("PENDING");
    expect(initialBreakStatus("RECEPTION")).toBe("ACTIVE");
    expect(initialBreakStatus("GYM_ADMIN")).toBe("ACTIVE");
  });
  it("happy path and each denial", () => {
    expect(canRequestBreak(ok)).toBe("OK");
    expect(canRequestBreak({ ...ok, requesterId: "other" })).toBe("COACH_CAN_ONLY_REQUEST_FOR_SELF");
    expect(canRequestBreak({ ...ok, coachHasActiveBreak: true })).toBe("COACH_ALREADY_ON_BREAK");
    expect(canRequestBreak({ ...ok, anotherCoachActiveBreak: true })).toBe("ANOTHER_COACH_ON_BREAK");
    expect(canRequestBreak({ ...ok, coachOnShift: false })).toBe("NOT_ON_SHIFT");
    expect(canRequestBreak({ ...ok, breaksTodayCounted: 2 })).toBe("DAILY_LIMIT_REACHED");
  });
  it("reception may act for any coach", () => {
    expect(canRequestBreak({ ...ok, requesterRole: "RECEPTION", requesterId: "r1" })).toBe("OK");
  });
  it("rejected breaks do not count toward the daily limit", () => {
    expect(countsTowardDailyLimit("REJECTED")).toBe(false);
    expect(["PENDING", "ACTIVE", "COMPLETED"].every((s) => countsTowardDailyLimit(s as never))).toBe(true);
  });
  it("approve re-checks the one-at-a-time rule", () => {
    expect(canApproveBreak({ status: "PENDING", anotherCoachActiveBreak: false })).toBe("OK");
    expect(canApproveBreak({ status: "PENDING", anotherCoachActiveBreak: true })).toBe("ANOTHER_COACH_ON_BREAK");
    expect(canApproveBreak({ status: "ACTIVE", anotherCoachActiveBreak: false })).toBe("NOT_PENDING");
  });
  it("overrun is measured from the real start and re-notified every 15 minutes", () => {
    const startedAt = d("2026-06-10T10:00:00Z");
    expect(isBreakOverdue({ startedAt, now: d("2026-06-10T10:30:00Z"), maxMinutes: 30 })).toBe(false);
    expect(isBreakOverdue({ startedAt, now: d("2026-06-10T10:31:00Z"), maxMinutes: 30 })).toBe(true);
    expect(shouldNotifyOverdue({ lastNotifiedAt: null, now: startedAt })).toBe(true);
    expect(shouldNotifyOverdue({ lastNotifiedAt: d("2026-06-10T10:31:00Z"), now: d("2026-06-10T10:40:00Z") })).toBe(false);
    expect(shouldNotifyOverdue({ lastNotifiedAt: d("2026-06-10T10:31:00Z"), now: d("2026-06-10T10:46:00Z") })).toBe(true);
  });
});

describe("rotation queue", () => {
  const c = (id: string, p: Partial<{ isActive: boolean; onShift: boolean; onBreak: boolean }> = {}) => ({ id, isActive: true, onShift: true, onBreak: false, ...p });
  const q = (...ids: string[]) => ids.map((coachId, i) => ({ coachId, position: i + 1 }));
  it("lowest queue position among coaches on shift", () => {
    expect(recommendCoach({ coaches: [c("a"), c("b"), c("c")], queue: q("b", "a", "c"), rejectedCoachIds: [] })).toEqual({ coachId: "b", reason: "OK" });
  });
  it("skips coaches on break, off shift, inactive and ones who rejected this profile", () => {
    const r = recommendCoach({
      coaches: [c("a", { onBreak: true }), c("b", { onShift: false }), c("c", { isActive: false }), c("d"), c("e")],
      queue: q("a", "b", "c", "d", "e"), rejectedCoachIds: ["d"],
    });
    expect(r).toEqual({ coachId: "e", reason: "OK" });
  });
  it("a coach missing from the queue goes first", () => {
    expect(recommendCoach({ coaches: [c("a"), c("new")], queue: q("a"), rejectedCoachIds: [] })).toEqual({ coachId: "new", reason: "OK" });
  });
  it("returns NO_COACH_ON_SHIFT when nobody is on shift, and NO_ELIGIBLE_COACH when all on-shift coaches are unavailable", () => {
    const rNoShift = recommendCoach({ coaches: [c("a", { onShift: false }), c("b", { onShift: false })], queue: q("b", "a"), rejectedCoachIds: [] });
    expect(rNoShift).toEqual({ coachId: null, reason: "NO_COACH_ON_SHIFT" });
    const rNoEligible = recommendCoach({ coaches: [c("a", { onBreak: true })], queue: [], rejectedCoachIds: [] });
    expect(rNoEligible).toEqual({ coachId: null, reason: "NO_ELIGIBLE_COACH" });
  });
  it("moveToBack pushes the coach behind everyone", () => {
    const next = moveToBack(q("a", "b", "c"), "a");
    expect(next.find((x) => x.coachId === "a")!.position).toBe(4);
    expect(next).toHaveLength(3);
    expect(moveToBack([], "x")).toEqual([{ coachId: "x", position: 1 }]);
  });
});

describe("coach sessions", () => {
  const base = { source: "PT_LINKED" as const, alreadyIn: false, capacity: null, participantsCount: 0, hasSubscription: true, ptSessionsLeft: 5, freeSessionsLeft: 0 };
  it("add participant rules", () => {
    expect(canAddParticipant(base)).toBe("OK");
    expect(canAddParticipant({ ...base, alreadyIn: true })).toBe("ALREADY_IN_SESSION");
    expect(canAddParticipant({ ...base, capacity: 10, participantsCount: 10 })).toBe("SESSION_FULL");
    expect(canAddParticipant({ ...base, hasSubscription: false })).toBe("SUBSCRIPTION_REQUIRED");
    expect(canAddParticipant({ ...base, ptSessionsLeft: 0 })).toBe("NO_PT_SESSIONS_LEFT");
    expect(canAddParticipant({ ...base, ptSessionsLeft: null })).toBe("OK");
    expect(canAddParticipant({ ...base, source: "FREE_GRANT", freeSessionsLeft: 0 })).toBe("NO_FREE_SESSIONS_LEFT");
    expect(canAddParticipant({ ...base, source: "FREE_GRANT", freeSessionsLeft: 1 })).toBe("OK");
  });
  it("only attended participants are charged; no-shows are free; repeat marking is idempotent", () => {
    const parts = [
      { memberId: "m1", source: "PT_LINKED" as const, subscriptionId: "s1", attended: false },
      { memberId: "m2", source: "PT_LINKED" as const, subscriptionId: "s2", attended: false },
      { memberId: "m3", source: "FREE_GRANT" as const, subscriptionId: null, attended: false },
      { memberId: "m4", source: "PT_LINKED" as const, subscriptionId: "s4", attended: true },
    ];
    const r = consumptionOnAttendance(parts, ["m1", "m3", "m4"]);
    expect(r.ptDeductions).toEqual([{ subscriptionId: "s1", count: 1 }]);
    expect(r.freeDeductions).toEqual([{ memberId: "m3", count: 1 }]);
  });
});

describe("visitor invitations", () => {
  it("quota and subscription state", () => {
    expect(canInviteVisitor({ subscriptionUsable: true, maxInvitations: 2, usedInvitations: 1 })).toBe("OK");
    expect(canInviteVisitor({ subscriptionUsable: true, maxInvitations: 2, usedInvitations: 2 })).toBe("NO_INVITATIONS_LEFT");
    expect(canInviteVisitor({ subscriptionUsable: false, maxInvitations: 2, usedInvitations: 0 })).toBe("SUBSCRIPTION_NOT_USABLE");
  });
});
