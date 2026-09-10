import type { RideRating } from "./cloud";

// Summarising ride ratings, and the small guard that stops one person
// hammering the button.

export interface LineSummary {
  line: string;
  /** Mean stars, or null when nobody has rated this line yet. */
  average: number | null;
  count: number;
  /** How many ratings gave 1..5 stars, indexed 0..4. */
  histogram: number[];
}

/**
 * Average stars per line.
 *
 * `lines` is passed in rather than derived from the ratings, so a line that
 * nobody has rated still appears - with a count of zero and an average of
 * null, not a silent absence and not a misleading 0.0 out of 5.
 */
export function summarise(
  ratings: RideRating[],
  lines: string[]
): LineSummary[] {
  return lines.map((line) => {
    const mine = ratings.filter((r) => r.line === line);
    const histogram = [0, 0, 0, 0, 0];
    let total = 0;
    for (const r of mine) {
      // Guard the index: a star value outside 1-5 should never be able to
      // write past the end of the histogram, whatever the database holds.
      if (r.stars >= 1 && r.stars <= 5) {
        histogram[r.stars - 1] += 1;
        total += r.stars;
      }
    }
    const counted = histogram.reduce((a, b) => a + b, 0);
    return {
      line,
      average: counted === 0 ? null : total / counted,
      count: counted,
      histogram,
    };
  });
}

/** One decimal place, for display: 4.25 -> "4.3", and "-" for no ratings. */
export function formatAverage(average: number | null): string {
  if (average === null) return "–";
  return average.toFixed(1);
}

/**
 * How many whole and half stars to draw for an average.
 *
 * Rounds to the nearest half so 4.25 shows four and a half rather than
 * pretending to a precision the number does not have.
 */
export function starParts(average: number | null): {
  full: number;
  half: boolean;
} {
  if (average === null) return { full: 0, half: false };
  const clamped = Math.min(5, Math.max(0, average));
  const halves = Math.round(clamped * 2);
  return { full: Math.floor(halves / 2), half: halves % 2 === 1 };
}

/** Ratings are one per line per this many hours, per browser. */
export const RATE_COOLDOWN_HOURS = 6;
const RATE_KEY = "ynu.rated";

/**
 * A deliberately modest anti-spam guard.
 *
 * Ratings are posted anonymously, so there is no honest way to enforce "one
 * per person" - this only remembers, in this browser, that this line was
 * rated recently. It stops the accidental double-tap and the bored refresh;
 * it will not stop anyone who opens a private window, and it is not pretending
 * to. Doing better needs student accounts, which this project does not have.
 */
export function recentlyRated(
  line: string,
  now: number = Date.now(),
  storage: Storage | undefined = globalThis.localStorage
): boolean {
  try {
    const raw = storage?.getItem(RATE_KEY);
    if (!raw) return false;
    const seen = JSON.parse(raw) as Record<string, number>;
    const at = seen[line];
    if (typeof at !== "number") return false;
    return now - at < RATE_COOLDOWN_HOURS * 3600 * 1000;
  } catch {
    // Private browsing, disabled storage, or corrupted JSON. Letting someone
    // rate twice is a far smaller problem than a crashed page.
    return false;
  }
}

export function markRated(
  line: string,
  now: number = Date.now(),
  storage: Storage | undefined = globalThis.localStorage
): void {
  try {
    const raw = storage?.getItem(RATE_KEY);
    const seen = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    seen[line] = now;
    storage?.setItem(RATE_KEY, JSON.stringify(seen));
  } catch {
    // Not being able to remember is survivable; see above.
  }
}
