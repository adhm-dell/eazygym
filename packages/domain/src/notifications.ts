/**
 * Expiry reminders: given the thresholds (e.g. [7,3,1]) and the ones already
 * sent, return the single threshold to send now (the tightest one reached).
 */
export function nextExpiryReminder(input: {
  endDate: Date;
  now: Date;
  thresholds: number[];
  alreadySent: number[];
}): number | null {
  const daysLeft = Math.ceil((input.endDate.getTime() - input.now.getTime()) / 86_400_000);
  if (daysLeft <= 0) return null; // expired is a different notification
  const reached = input.thresholds.filter((t) => daysLeft <= t && !input.alreadySent.includes(t));
  if (reached.length === 0) return null;
  return Math.min(...reached);
}

export const expiryDedupeKey = (subscriptionId: string, threshold: number) =>
  `sub-expiring:${subscriptionId}:${threshold}`;
