/**
 * Money is handled as INTEGER minor units (piasters) inside the domain layer.
 * Convert at the boundary with toMinor/fromMinor (Prisma Decimal <-> number).
 */
export type Minor = number;

export const toMinor = (v: number | string): Minor => Math.round(Number(v) * 100);
export const fromMinor = (m: Minor): number => m / 100;

/** Split `total` into `parts` equal slices; the remainder goes to the LAST slice. */
export function splitEvenly(total: Minor, parts: number): Minor[] {
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError("parts must be >= 1");
  const base = Math.floor(total / parts);
  const out = Array.from({ length: parts }, () => base);
  out[parts - 1] = total - base * (parts - 1);
  return out;
}

/** Largest-remainder allocation of `total` proportionally to `weights`. Sum is exact. */
export function allocateProRata(total: Minor, weights: number[]): Minor[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const floors = raw.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left--;
  }
  return floors;
}

/** amount * percent / 100, rounded half-up to a whole minor unit. */
export const percentOf = (amount: Minor, percent: number): Minor =>
  Math.round((amount * percent) / 100);

/** amount * bps / 10000, rounded half-up. */
export const bpsOf = (amount: Minor, bps: number): Minor => Math.round((amount * bps) / 10_000);
