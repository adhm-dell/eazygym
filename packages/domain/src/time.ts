export const DAY_MS = 86_400_000;

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);

/** Whole days from a to b, rounded up (b later than a => positive). */
export const diffDaysCeil = (a: Date, b: Date): number => Math.ceil((b.getTime() - a.getTime()) / DAY_MS);
export const diffDaysFloor = (a: Date, b: Date): number => Math.floor((b.getTime() - a.getTime()) / DAY_MS);

export const parseHHMM = (s: string): number => {
  const [h, m] = s.split(":");
  return parseInt(h ?? "0", 10) * 60 + parseInt(m ?? "0", 10);
};

export interface LocalParts {
  /** 0 = Sunday .. 6 = Saturday */
  dayOfWeek: number;
  /** minutes since local midnight */
  minutes: number;
  /** YYYY-MM-DD in the gym's timezone */
  ymd: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Wall-clock parts of `date` in an IANA timezone (default Africa/Cairo, which has DST). */
export function localParts(date: Date, timeZone = "Africa/Cairo"): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  const hour = parseInt(p.hour ?? "0", 10) % 24;
  return {
    dayOfWeek: WEEKDAYS.indexOf(p.weekday ?? "Sun"),
    minutes: hour * 60 + parseInt(p.minute ?? "0", 10),
    ymd: `${p.year}-${p.month}-${p.day}`,
  };
}
