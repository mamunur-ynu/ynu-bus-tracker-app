// Trip progress for the driver console.
//
// A driver on shift is somewhere along their line's stop sequence. This works
// out where, purely from the elapsed trip time and the real route-board
// segment times - the same numbers the rider-facing arrivals board uses.
//
// IMPORTANT, and stated plainly in the UI too: this is a SIMULATED position,
// not satellite positioning. The app has no way to know where a real bus is;
// the campus stop coordinates are percentages on a map image, not latitude and
// longitude, so there is nothing honest to match a GPS fix against. Modelling
// it from the timetable is the truthful option - inventing a moving dot and
// calling it GPS would not be.
import { segMinutes } from "./arrivals";

export interface TripProgress {
  /** Index of the stop the bus has most recently left (or is sitting at). */
  currentIndex: number;
  /** Index of the stop it is heading to; equal to currentIndex at the end. */
  nextIndex: number;
  /** Minutes until it reaches the next stop. */
  minutesToNext: number;
  /** 0-1 across the whole trip. */
  fraction: number;
  /** True once the bus has reached the final stop on the line. */
  finished: boolean;
}

/** Cumulative minutes at which the bus reaches each stop in the sequence. */
export function tripOffsets(stopIds: number[]): number[] {
  const offsets: number[] = [0];
  for (let i = 1; i < stopIds.length; i++) {
    offsets.push(offsets[i - 1] + segMinutes(stopIds[i - 1], stopIds[i]));
  }
  return offsets;
}

/** Total scheduled minutes for one run along the line. */
export function tripDuration(stopIds: number[]): number {
  const offsets = tripOffsets(stopIds);
  return offsets[offsets.length - 1] ?? 0;
}

/**
 * Where the bus is after `elapsedMin` of the run.
 *
 * A trip is a one-way run along the stop list, not the looping model the
 * arrivals board uses: a driver's shift ends at the terminus rather than
 * wrapping round to the start, so this clamps at the last stop instead of
 * taking a modulo.
 */
export function tripProgress(stopIds: number[], elapsedMin: number): TripProgress {
  const last = stopIds.length - 1;
  if (last <= 0) {
    return {
      currentIndex: 0,
      nextIndex: 0,
      minutesToNext: 0,
      fraction: 1,
      finished: true,
    };
  }

  const offsets = tripOffsets(stopIds);
  const total = offsets[last];
  const t = Math.max(0, Math.min(total, elapsedMin));

  if (t >= total) {
    return {
      currentIndex: last,
      nextIndex: last,
      minutesToNext: 0,
      fraction: 1,
      finished: true,
    };
  }

  // The last stop whose scheduled time has passed.
  let currentIndex = 0;
  for (let i = 0; i < offsets.length; i++) {
    if (offsets[i] <= t) currentIndex = i;
    else break;
  }
  const nextIndex = Math.min(currentIndex + 1, last);
  return {
    currentIndex,
    nextIndex,
    minutesToNext: offsets[nextIndex] - t,
    fraction: total === 0 ? 1 : t / total,
    finished: false,
  };
}
