// Traffic signals and how a bus behaves around them.
//
// This lives outside MiniCity3D.tsx for one reason: it is the part that can
// be wrong in a way you cannot see in a screenshot. The 3D scene looked fine
// while the buses were driving straight through red lights, because the lamps
// and the buses were two separate animations that never consulted each other.
// Pulled out here as plain functions, "a bus must not pull away on a red" is
// something a test can actually hold us to.

/** Seconds for a full green -> amber -> red loop. */
export const CYCLE = 12;
export const GREEN_ENDS = 5;
export const AMBER_ENDS = 6.5;

export type Phase = "green" | "amber" | "red";

/**
 * What a signal is showing right now, and how long that has left.
 *
 * `offset` staggers the junctions so they do not all change together.
 * Everything that cares about a light - the lamp that glows, the countdown
 * board, and the bus deciding whether to move - calls this, so they cannot
 * drift apart.
 */
export function phaseOf(
  offset: number,
  elapsedSec: number
): { phase: Phase; left: number } {
  const p = (((elapsedSec + offset) % CYCLE) + CYCLE) % CYCLE;
  if (p < GREEN_ENDS) return { phase: "green", left: GREEN_ENDS - p };
  if (p < AMBER_ENDS) return { phase: "amber", left: AMBER_ENDS - p };
  return { phase: "red", left: CYCLE - p };
}

/** A bus may only set off on a green. Amber means "do not start". */
export function mayProceed(phase: Phase): boolean {
  return phase === "green";
}

export const ACCEL = 6; // units/s^2 pulling away from a stop
export const BRAKE = 9; // units/s^2 slowing into one
export const DWELL = 1.8; // seconds letting passengers on and off

/** The fixed shape of one bus's round trip. */
export interface BusPath {
  /** Cumulative distance from the start to each node. */
  cum: number[];
  /** Which stop sits at each node, so its signal can be looked up. */
  nodeStops: number[];
}

/** Everything about a bus that changes from frame to frame. */
export interface BusState {
  /** Distance travelled along the path. */
  s: number;
  /** Current speed in world units per second. */
  v: number;
  /** Index of the node being driven towards. */
  node: number;
  /** True while parked at a node. */
  halted: boolean;
  /** Seconds of passenger dwell still to serve. */
  wait: number;
}

/**
 * Drive a bus forward by `dt` seconds.
 *
 * Two rules do all the work.
 *
 * Approaching a node, the bus may go no faster than it could still brake
 * from - sqrt(2 * BRAKE * distance) - which is what turns arriving at a stop
 * into a smooth roll instead of a snap to zero, with no easing curve to tune.
 *
 * Leaving a node, it waits on two separate conditions: the dwell must be
 * finished AND, where there is a signal, that signal must be green. Both have
 * to hold, so a short dwell can never let a bus creep out on a red.
 *
 * `signalOffset` returns the signal offset for a stop, or null where that stop
 * has no light at all.
 */
export function stepBus(
  st: BusState,
  path: BusPath,
  cruise: number,
  dt: number,
  elapsedSec: number,
  signalOffset: (stopId: number) => number | null
): void {
  if (st.halted) {
    st.v = 0;
    if (st.wait > 0) st.wait = Math.max(0, st.wait - dt);

    const offset = signalOffset(path.nodeStops[st.node]);
    const held =
      offset !== null && !mayProceed(phaseOf(offset, elapsedSec).phase);

    if (st.wait <= 0 && !held) {
      st.halted = false;
      st.node += 1;
      if (st.node >= path.cum.length) {
        // Round again. The last node sits on top of the first, so the bus
        // carries on from there rather than jumping.
        st.node = 1;
        st.s = 0;
      }
    }
    return;
  }

  const gap = Math.max(0, path.cum[st.node] - st.s);
  const canStillBrake = Math.sqrt(2 * BRAKE * gap);
  const want = Math.min(cruise, canStillBrake);
  st.v =
    st.v < want
      ? Math.min(want, st.v + ACCEL * dt)
      : Math.max(want, st.v - BRAKE * dt);
  st.s += st.v * dt;

  // Land exactly on the node rather than a little past it, so the bus parks
  // at the stop sign instead of just beyond it.
  if (st.s >= path.cum[st.node] - 0.05) {
    st.s = path.cum[st.node];
    st.v = 0;
    st.halted = true;
    st.wait = DWELL;
  }
}

/**
 * Ease a heading towards `target`, always turning the short way round.
 *
 * Assigning the angle outright made the bus flick instantly round corners,
 * and a naive difference sends it the long way whenever the turn crosses the
 * +/-PI seam - a right turn played as a 270-degree spin.
 */
export function easeHeading(
  current: number,
  target: number,
  dt: number,
  rate = 5
): number {
  let turn = target - current;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  return current + turn * Math.min(1, dt * rate);
}
