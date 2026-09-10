// The live-arrivals simulation, extracted so more than one screen can use it.
//
// This used to live inside LiveArrivals.tsx. The Student Home screen needs the
// same answer ("when does the next bus reach THIS stop?") and copying the maths
// into a second component is how two screens quietly start disagreeing with
// each other. One engine, one set of numbers, and — because it is now plain
// functions instead of JSX — it can actually be unit-tested.
import { busLines, routes } from "../data/campusData";

// How fast the simulation clock runs: route-minutes advanced per real second.
// 0.4 => one route-minute every 2.5 seconds, so ETAs tick down believably.
export const SIM_MIN_PER_SEC = 0.4;

// Fixed time for a bus to loop from its last stop back to the first.
export const RETURN_MIN = 6;

export interface LineModel {
  code: string;
  name: string;
  color: string;
  stopIds: number[];
  /** Cumulative arrival time (in route-minutes) at each stop in stopIds. */
  offsets: number[];
  /** Total time for one full loop, including the return leg. */
  loopTotal: number;
}

export interface StopArrival {
  /** Stop id. */
  id: number;
  /** Minutes until this line's bus reaches that stop. */
  eta: number;
}

/** Travel minutes between two adjacent stops, from the route-board edges. */
export function segMinutes(a: number, b: number): number {
  const forward = routes.find(
    (r) => r.sourceStopId === a && r.destinationStopId === b
  );
  if (forward) return forward.travelTimeMinutes;
  const reverse = routes.find(
    (r) => r.sourceStopId === b && r.destinationStopId === a
  );
  return reverse ? reverse.travelTimeMinutes : 3;
}

/** Build the per-line timing model: when the bus reaches each stop on its loop. */
export function buildLineModels(): LineModel[] {
  return busLines.map((line) => {
    const offsets: number[] = [0];
    for (let i = 1; i < line.stopIds.length; i++) {
      offsets.push(
        offsets[i - 1] + segMinutes(line.stopIds[i - 1], line.stopIds[i])
      );
    }
    const loopTotal = offsets[offsets.length - 1] + RETURN_MIN;
    return {
      code: line.code,
      name: line.displayName,
      color: line.color,
      stopIds: line.stopIds,
      offsets,
      loopTotal,
    };
  });
}

/**
 * The simulation clock, anchored to wall-clock time.
 *
 * Every screen MUST get its elapsed seconds from here. Each screen used to
 * start its own clock when it mounted (`Date.now()` captured in a ref), which
 * quietly meant two screens disagreed about where the same bus was: open the
 * Home screen, wait five minutes, switch to the arrivals board, and one said
 * the Library bus was 19 minutes away while the other said 11. Sharing the
 * ETA *maths* was not enough - they have to share the *clock* too.
 *
 * Anchoring to the Unix epoch rather than to any mount time also means the
 * buses stay where they were across a page reload, and two people looking at
 * two phones see the same thing.
 */
export function simElapsedSec(now: number = Date.now()): number {
  return now / 1000;
}

/** Where the bus is on its loop right now, in route-minutes from the first stop. */
export function loopPosition(line: LineModel, elapsedSec: number): number {
  return (elapsedSec * SIM_MIN_PER_SEC) % line.loopTotal;
}

/**
 * Every stop on this line with its ETA, soonest first. The modulo is what makes
 * the board wrap correctly: a stop the bus has just passed is not "-2 minutes
 * away", it is a whole loop away.
 */
export function arrivalsFor(line: LineModel, elapsedSec: number): StopArrival[] {
  const pos = loopPosition(line, elapsedSec);
  return line.stopIds
    .map((id, i) => ({
      id,
      eta: (line.offsets[i] - pos + line.loopTotal) % line.loopTotal,
    }))
    .sort((a, b) => a.eta - b.eta);
}

export interface NextBus {
  line: LineModel;
  stopId: number;
  eta: number;
}

/**
 * The soonest bus arriving at one particular stop, across every line that
 * serves it. This is what the Home screen's "next bus" card answers.
 * Returns null when no line serves that stop at all.
 */
export function nextBusForStop(
  lines: LineModel[],
  stopId: number,
  elapsedSec: number
): NextBus | null {
  let best: NextBus | null = null;
  for (const line of lines) {
    const i = line.stopIds.indexOf(stopId);
    if (i === -1) continue;
    const pos = loopPosition(line, elapsedSec);
    const eta = (line.offsets[i] - pos + line.loopTotal) % line.loopTotal;
    if (!best || eta < best.eta) best = { line, stopId, eta };
  }
  return best;
}

/** Format route-minutes as m:ss, never negative. */
export function mmss(minutes: number): string {
  const total = Math.max(0, Math.round(minutes * 60));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Whole minutes remaining, for the big countdown on the Home card.
 *
 * m:ss is right on a dense arrivals board, but at hero size "10:24" reads as
 * the time of day rather than a countdown - the first render of the Home
 * screen genuinely looked like the bus arrives at twenty-four past ten.
 * Rounding up keeps the promise honest (it never says 9 when there are still
 * 9 minutes 40 seconds to run) and floors at 1 so the number never hits zero
 * while the caller is still showing a countdown instead of "arriving now".
 */
export function minutesLeft(minutes: number): number {
  return Math.max(1, Math.ceil(minutes));
}
