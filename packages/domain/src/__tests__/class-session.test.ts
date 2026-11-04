import { describe, expect, it } from "vitest";
import { canStartClass } from "..";

describe("reception starts a class", () => {
  const base = { scheduleDayOfWeek: 3, now: new Date("2026-06-10T18:10:00Z"), timeZone: "UTC", cancelledToday: false, alreadyStarted: false };
  it("ok on the scheduled day", () => expect(canStartClass(base)).toBe("OK"));
  it("not on another weekday", () => expect(canStartClass({ ...base, scheduleDayOfWeek: 4 })).toBe("NOT_SCHEDULED_TODAY"));
  it("not twice, not when cancelled", () => {
    expect(canStartClass({ ...base, alreadyStarted: true })).toBe("ALREADY_STARTED");
    expect(canStartClass({ ...base, cancelledToday: true })).toBe("CANCELLED_TODAY");
  });
});
