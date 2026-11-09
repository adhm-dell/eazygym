import { localParts, parseHHMM } from "./time";

// ---------------------------------------------------------------------------
// Coach working shifts (weekly timetable, overnight aware, gym timezone)
// ---------------------------------------------------------------------------
export interface CoachShiftRow {
  coachId: string;
  dayOfWeek: number; // day the shift starts, 0 = Sunday
  startTime: string; // "HH:MM"
  endTime: string;
  isActive: boolean;
}

/** startTime > endTime means the shift runs past midnight into the next day. */
export function isOnShift(shifts: CoachShiftRow[], now: Date, timeZone?: string): boolean {
  const { dayOfWeek, minutes } = localParts(now, timeZone);
  return shifts.some((s) => {
    if (!s.isActive) return false;
    const start = parseHHMM(s.startTime);
    const end = parseHHMM(s.endTime);
    if (start <= end) return s.dayOfWeek === dayOfWeek && minutes >= start && minutes <= end;
    const startsToday = s.dayOfWeek === dayOfWeek && minutes >= start;
    const endsToday = (s.dayOfWeek + 1) % 7 === dayOfWeek && minutes <= end;
    return startsToday || endsToday;
  });
}

export function coachIdsOnShift(shifts: CoachShiftRow[], now: Date, timeZone?: string): string[] {
  const ids = new Set(shifts.map((s) => s.coachId));
  return [...ids].filter((id) => isOnShift(shifts.filter((s) => s.coachId === id), now, timeZone));
}

// ---------------------------------------------------------------------------
// Coach breaks
// ---------------------------------------------------------------------------
export type BreakRequesterRole = "COACH" | "RECEPTION" | "GYM_ADMIN" | "SUPER_ADMIN";
export type BreakStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "REJECTED";

export type BreakDenial =
  | "OK"
  | "COACH_CAN_ONLY_REQUEST_FOR_SELF"
  | "NOT_ON_SHIFT"
  | "COACH_ALREADY_ON_BREAK"
  | "ANOTHER_COACH_ON_BREAK"
  | "DAILY_LIMIT_REACHED";

/** Admin / reception start a break directly (ACTIVE); a coach's own request waits for approval. */
export const initialBreakStatus = (role: BreakRequesterRole): "ACTIVE" | "PENDING" =>
  role === "COACH" ? "PENDING" : "ACTIVE";

/** REJECTED requests do not use up the daily allowance; PENDING ones do (prevents request spam). */
export const countsTowardDailyLimit = (status: BreakStatus): boolean => status !== "REJECTED";

export function canRequestBreak(input: {
  requesterRole: BreakRequesterRole;
  requesterId: string;
  coachId: string;
  coachOnShift: boolean;
  coachHasActiveBreak: boolean;
  anotherCoachActiveBreak: boolean; // any ACTIVE break in the gym (other than this coach's)
  breaksTodayCounted: number;
  maxPerDay: number;
}): BreakDenial {
  if (input.requesterRole === "COACH" && input.requesterId !== input.coachId) return "COACH_CAN_ONLY_REQUEST_FOR_SELF";
  if (input.coachHasActiveBreak) return "COACH_ALREADY_ON_BREAK";
  if (input.anotherCoachActiveBreak) return "ANOTHER_COACH_ON_BREAK";
  if (!input.coachOnShift) return "NOT_ON_SHIFT";
  if (input.breaksTodayCounted >= input.maxPerDay) return "DAILY_LIMIT_REACHED";
  return "OK";
}

/** Approve re-checks the one-at-a-time rule, because someone may have started a break meanwhile. */
export function canApproveBreak(input: { status: BreakStatus; anotherCoachActiveBreak: boolean }): "OK" | "NOT_PENDING" | "ANOTHER_COACH_ON_BREAK" {
  if (input.status !== "PENDING") return "NOT_PENDING";
  if (input.anotherCoachActiveBreak) return "ANOTHER_COACH_ON_BREAK";
  return "OK";
}

/** Overrun is measured from when the break STARTED (not from when it was requested). */
export const isBreakOverdue = (input: { startedAt: Date; now: Date; maxMinutes: number }): boolean =>
  (input.now.getTime() - input.startedAt.getTime()) / 60_000 > input.maxMinutes;

/** Re-notify an overdue break at most every `repeatMinutes` (default 15). */
export const shouldNotifyOverdue = (input: { lastNotifiedAt: Date | null; now: Date; repeatMinutes?: number }): boolean =>
  input.lastNotifiedAt === null ||
  (input.now.getTime() - input.lastNotifiedAt.getTime()) / 60_000 >= (input.repeatMinutes ?? 15);

// ---------------------------------------------------------------------------
// Rotation queue: who gets the next new member
// ---------------------------------------------------------------------------
export interface RotationCoach {
  id: string;
  isActive: boolean;
  onShift: boolean;
  onBreak: boolean;
}
export interface QueueEntry {
  coachId: string;
  position: number; // lower = next
}

export type RotationReason = "OK" | "NO_COACH_ON_SHIFT" | "NO_ELIGIBLE_COACH";

export function recommendCoach(input: {
  coaches: RotationCoach[];
  queue: QueueEntry[];
  rejectedCoachIds: string[];
}): { coachId: string | null; reason: RotationReason } {
  const onShift = input.coaches.filter((c) => c.isActive && c.onShift);
  if (onShift.length === 0) return { coachId: null, reason: "NO_COACH_ON_SHIFT" };
  const eligible = onShift.filter((c) => !c.onBreak && !input.rejectedCoachIds.includes(c.id));
  if (eligible.length === 0) return { coachId: null, reason: "NO_ELIGIBLE_COACH" };
  const pos = new Map(input.queue.map((q) => [q.coachId, q.position]));
  const missing = eligible.find((c) => !pos.has(c.id));
  if (missing) return { coachId: missing.id, reason: "OK" };
  const next = [...eligible].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))[0]!;
  return { coachId: next.id, reason: "OK" };
}

/** After a coach is recommended, accepts or rejects, he goes to the back of the line. */
export function moveToBack(queue: QueueEntry[], coachId: string): QueueEntry[] {
  const max = queue.reduce((m, q) => Math.max(m, q.position), 0);
  const rest = queue.filter((q) => q.coachId !== coachId);
  return [...rest, { coachId, position: max + 1 }];
}

// ---------------------------------------------------------------------------
// Coach sessions (private / group) - billing happens on ATTENDANCE only
// ---------------------------------------------------------------------------
export type SessionSourceKind = "FREE_GRANT" | "PT_LINKED" | "CLASS_LINKED";
export type AddParticipantDenial =
  | "OK"
  | "ALREADY_IN_SESSION"
  | "SESSION_FULL"
  | "SUBSCRIPTION_REQUIRED"
  | "NO_PT_SESSIONS_LEFT"
  | "NO_FREE_SESSIONS_LEFT";

export function canAddParticipant(input: {
  source: SessionSourceKind;
  alreadyIn: boolean;
  capacity: number | null; // null = no limit (private sessions)
  participantsCount: number;
  hasSubscription: boolean;
  ptSessionsLeft: number | null; // null = unlimited
  freeSessionsLeft: number;
}): AddParticipantDenial {
  if (input.alreadyIn) return "ALREADY_IN_SESSION";
  if (input.capacity !== null && input.participantsCount >= input.capacity) return "SESSION_FULL";
  if (input.source === "PT_LINKED") {
    if (!input.hasSubscription) return "SUBSCRIPTION_REQUIRED";
    if (input.ptSessionsLeft !== null && input.ptSessionsLeft <= 0) return "NO_PT_SESSIONS_LEFT";
  }
  if (input.source === "CLASS_LINKED" && !input.hasSubscription) return "SUBSCRIPTION_REQUIRED";
  if (input.source === "FREE_GRANT" && input.freeSessionsLeft <= 0) return "NO_FREE_SESSIONS_LEFT";
  return "OK";
}

/** Only attended participants consume a session; no-shows are never charged. */
export function consumptionOnAttendance(
  participants: { memberId: string; source: SessionSourceKind; subscriptionId: string | null; attended: boolean }[],
  attendedMemberIds: string[],
): { ptDeductions: { subscriptionId: string; count: number }[]; freeDeductions: { memberId: string; count: number }[] } {
  const pt = new Map<string, number>();
  const free = new Map<string, number>();
  for (const p of participants) {
    if (p.attended || !attendedMemberIds.includes(p.memberId)) continue; // already counted / not present
    if (p.source === "PT_LINKED" && p.subscriptionId) pt.set(p.subscriptionId, (pt.get(p.subscriptionId) ?? 0) + 1);
    if (p.source === "FREE_GRANT") free.set(p.memberId, (free.get(p.memberId) ?? 0) + 1);
  }
  return {
    ptDeductions: [...pt].map(([subscriptionId, count]) => ({ subscriptionId, count })),
    freeDeductions: [...free].map(([memberId, count]) => ({ memberId, count })),
  };
}

// ---------------------------------------------------------------------------
// Visitor invitations
// ---------------------------------------------------------------------------
export function canInviteVisitor(input: {
  subscriptionUsable: boolean; // active, not frozen / overdue
  maxInvitations: number;
  usedInvitations: number;
}): "OK" | "SUBSCRIPTION_NOT_USABLE" | "NO_INVITATIONS_LEFT" {
  if (!input.subscriptionUsable) return "SUBSCRIPTION_NOT_USABLE";
  if (input.usedInvitations >= input.maxInvitations) return "NO_INVITATIONS_LEFT";
  return "OK";
}
