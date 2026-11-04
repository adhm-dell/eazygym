import { localParts } from "./time";

export type StartClassDenial = "OK" | "NOT_SCHEDULED_TODAY" | "CANCELLED_TODAY" | "ALREADY_STARTED";

/** Reception may start a class on its scheduled weekday, once, unless it is cancelled. */
export function canStartClass(input: {
  scheduleDayOfWeek: number;
  now: Date;
  timeZone?: string;
  cancelledToday: boolean;
  alreadyStarted: boolean;
}): StartClassDenial {
  if (localParts(input.now, input.timeZone).dayOfWeek !== input.scheduleDayOfWeek) return "NOT_SCHEDULED_TODAY";
  if (input.cancelledToday) return "CANCELLED_TODAY";
  if (input.alreadyStarted) return "ALREADY_STARTED";
  return "OK";
}
