import { localParts } from "./time";

export type PlanKind = "GYM" | "PT" | "CLASS";

/** A class slot the member is registered in, already resolved for TODAY's exception (if any). */
export interface ClassSlot {
  id: string;
  dayOfWeek: number; // 0 = Sunday
  startMinutes: number;
  endMinutes: number;
  /** today's exception: cancelled or rescheduled */
  todayCancelled?: boolean;
  todayStartMinutes?: number;
  todayEndMinutes?: number;
  /** Reception's manual start/stop of today's occurrence (ClassSession row), if any. */
  todayRun?: { startedAt: Date; endedAt?: Date | null } | null;
}

export interface AccessSubscription {
  id: string;
  kind: PlanKind;
  grantsFloorAccess: boolean;
  startDate: Date;
  endDate: Date;
  cancelled: boolean;
  /** minimum upfront payment satisfied */
  activated: boolean;
  /** has an open freeze right now */
  frozen: boolean;
  /** unpaid balance past its due date (computed by isOverdue) */
  overdue: boolean;
  sessionsLeft: number | null; // null = unlimited
  classSlots?: ClassSlot[];
}

export type SubStatus =
  | "ACTIVE"
  | "CANCELLED"
  | "PENDING_PAYMENT"
  | "NOT_STARTED"
  | "FROZEN"
  | "EXPIRED"
  | "PAYMENT_OVERDUE"
  | "NO_SESSIONS_LEFT"
  | "NO_FLOOR_ACCESS"
  | "CLASS_NOT_TODAY"
  | "CLASS_CANCELLED"
  | "CLASS_OUT_OF_TIME"
  | "CLASS_NOT_STARTED" // reception has not started today's class yet
  | "CLASS_ENDED"; // class finished (manually ended or its length ran out)

export type AccessReason = SubStatus | "BLOCKED" | "NO_SUBSCRIPTION" | "PT_EXPIRED";

export interface AccessDecision {
  allowed: boolean;
  reason: AccessReason;
  subscriptionId?: string;
  kind?: PlanKind;
  daysLeft?: number;
  expiringSoon?: boolean;
}

export interface AccessOptions {
  timeZone?: string;
  /**
   * RECEPTION_STARTS (default): members enter only after reception starts the class,
   * so a late coach does not break anything. The entry window runs from the actual
   * start for the scheduled class length (or until reception ends it).
   * SCHEDULED: fixed window from the timetable.
   */
  classEntryMode?: "RECEPTION_STARTS" | "SCHEDULED";
  classEarlyMinutes?: number; // SCHEDULED mode only: how early a member may scan in
  expiringSoonDays?: number;
}

/** Status of ONE subscription at `now`. Order matters. */
export function evaluateSubscription(sub: AccessSubscription, now: Date, opts: AccessOptions = {}): SubStatus {
  const t = now.getTime();
  if (sub.cancelled) return "CANCELLED";
  if (!sub.activated) return "PENDING_PAYMENT";
  if (t < sub.startDate.getTime()) return "NOT_STARTED";
  // Frozen wins over expired: the end date is extended when the freeze ends.
  if (sub.frozen) return "FROZEN";
  if (t > sub.endDate.getTime()) return "EXPIRED";
  if (sub.overdue) return "PAYMENT_OVERDUE";
  if (sub.sessionsLeft !== null && sub.sessionsLeft <= 0) return "NO_SESSIONS_LEFT";
  if (!sub.grantsFloorAccess) return "NO_FLOOR_ACCESS";

  if (sub.kind === "CLASS") return evaluateClass(sub, now, opts);
  return "ACTIVE";
}

function evaluateClass(sub: AccessSubscription, now: Date, opts: AccessOptions): SubStatus {
  const { dayOfWeek, minutes } = localParts(now, opts.timeZone);
  const mode = opts.classEntryMode ?? "RECEPTION_STARTS";
  const early = opts.classEarlyMinutes ?? 0;
  const today = (sub.classSlots ?? []).filter((s) => s.dayOfWeek === dayOfWeek);
  if (today.length === 0) return "CLASS_NOT_TODAY";

  const live = today.filter((s) => !s.todayCancelled);
  if (live.length === 0) return "CLASS_CANCELLED";

  const startOf = (s: ClassSlot) => s.todayStartMinutes ?? s.startMinutes;
  const endOf = (s: ClassSlot) => s.todayEndMinutes ?? s.endMinutes;

  if (mode === "SCHEDULED") {
    const inWindow = live.some((s) => minutes >= startOf(s) - early && minutes <= endOf(s));
    return inWindow ? "ACTIVE" : "CLASS_OUT_OF_TIME";
  }

  // RECEPTION_STARTS
  let notStarted = false;
  for (const s of live) {
    const run = s.todayRun;
    if (!run) {
      notStarted = true;
      continue;
    }
    const t = now.getTime();
    const lengthMs = Math.max(0, endOf(s) - startOf(s)) * 60_000;
    const effectiveEnd = run.endedAt ? run.endedAt.getTime() : run.startedAt.getTime() + lengthMs;
    if (t >= run.startedAt.getTime() && t < effectiveEnd) return "ACTIVE";
  }
  return notStarted ? "CLASS_NOT_STARTED" : "CLASS_ENDED";
}

// How close each denial is to "valid" - the most actionable one is reported.
const DENIAL_PRIORITY: SubStatus[] = [
  "PAYMENT_OVERDUE",
  "FROZEN",
  "PENDING_PAYMENT",
  "CLASS_NOT_STARTED",
  "CLASS_ENDED",
  "CLASS_OUT_OF_TIME",
  "CLASS_NOT_TODAY",
  "CLASS_CANCELLED",
  "NO_SESSIONS_LEFT",
  "NO_FLOOR_ACCESS",
  "NOT_STARTED",
  "EXPIRED",
  "CANCELLED",
];

const KIND_ORDER: Record<PlanKind, number> = { GYM: 0, CLASS: 1, PT: 2 };

/** THE single door decision. Used by the scanner, the reception screen and the member app. */
export function evaluateAccess(
  input: { isBlocked: boolean; subscriptions: AccessSubscription[] },
  now: Date,
  opts: AccessOptions = {},
): AccessDecision {
  if (input.isBlocked) return { allowed: false, reason: "BLOCKED" };
  if (input.subscriptions.length === 0) return { allowed: false, reason: "NO_SUBSCRIPTION" };

  const evaluated = input.subscriptions.map((s) => ({ s, status: evaluateSubscription(s, now, opts) }));

  const ok = evaluated
    .filter((e) => e.status === "ACTIVE")
    .sort((a, b) => KIND_ORDER[a.s.kind] - KIND_ORDER[b.s.kind] || b.s.endDate.getTime() - a.s.endDate.getTime());
  const best = ok[0];
  if (best) {
    const daysLeft = Math.max(0, Math.ceil((best.s.endDate.getTime() - now.getTime()) / 86_400_000));
    return {
      allowed: true,
      reason: "ACTIVE",
      subscriptionId: best.s.id,
      kind: best.s.kind,
      daysLeft,
      expiringSoon: daysLeft <= (opts.expiringSoonDays ?? 7),
    };
  }

  const denied = evaluated.sort(
    (a, b) =>
      DENIAL_PRIORITY.indexOf(a.status) - DENIAL_PRIORITY.indexOf(b.status) ||
      b.s.endDate.getTime() - a.s.endDate.getTime(),
  )[0]!;
  const reason: AccessReason = denied.s.kind === "PT" && denied.status === "EXPIRED" ? "PT_EXPIRED" : denied.status;
  return { allowed: false, reason, subscriptionId: denied.s.id, kind: denied.s.kind };
}
