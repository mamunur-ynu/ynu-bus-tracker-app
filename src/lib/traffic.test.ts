import { describe, it, expect } from "vitest";
import {
  AMBER_ENDS,
  BRAKE,
  CYCLE,
  DWELL,
  GREEN_ENDS,
  type BusPath,
  type BusState,
  easeHeading,
  mayProceed,
  phaseOf,
  stepBus,
} from "./traffic";

// The bug these tests exist for: in the 3D city the traffic lights cycled on
// their own timer and the buses drove on theirs, so buses sailed through red
// lights. It looked completely fine in a screenshot, which is exactly why it
// survived so long. The rule being pinned down here is simple - a bus may not
// pull away from a signalled junction unless that signal is green.

const NO_SIGNALS = () => null;

/** A straight run of four stops, 20 units apart. */
function path(nodeStops = [1, 2, 3, 4]): BusPath {
  return { cum: nodeStops.map((_, i) => i * 20), nodeStops };
}

function bus(over: Partial<BusState> = {}): BusState {
  return { s: 0, v: 0, node: 1, halted: false, wait: 0, ...over };
}

/** Run the simulation for `seconds`, in small steps like a real frame loop. */
function run(
  st: BusState,
  p: BusPath,
  seconds: number,
  signalOffset: (id: number) => number | null,
  startAt = 0,
  cruise = 7.5
) {
  const dt = 1 / 60;
  let el = startAt;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    stepBus(st, p, cruise, dt, el, signalOffset);
    el += dt;
  }
  return el;
}

/**
 * Run until the bus parks, rather than for a guessed number of seconds.
 * Timing out here means it never stopped at all, which is itself the failure.
 */
function runUntilHalt(
  st: BusState,
  p: BusPath,
  signalOffset: (id: number) => number | null = NO_SIGNALS,
  cruise = 7.5
) {
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 60; i++) {
    stepBus(st, p, cruise, dt, 0, signalOffset);
    if (st.halted) return i * dt;
  }
  throw new Error("bus never came to a stop");
}

describe("phaseOf", () => {
  it("runs green, then amber, then red", () => {
    expect(phaseOf(0, 0).phase).toBe("green");
    expect(phaseOf(0, GREEN_ENDS - 0.01).phase).toBe("green");
    expect(phaseOf(0, GREEN_ENDS).phase).toBe("amber");
    expect(phaseOf(0, AMBER_ENDS - 0.01).phase).toBe("amber");
    expect(phaseOf(0, AMBER_ENDS).phase).toBe("red");
    expect(phaseOf(0, CYCLE - 0.01).phase).toBe("red");
  });

  it("starts the cycle again after a full loop", () => {
    expect(phaseOf(0, CYCLE)).toEqual(phaseOf(0, 0));
    expect(phaseOf(0, CYCLE * 7 + 3).phase).toBe(phaseOf(0, 3).phase);
  });

  it("counts down the time left in the current phase", () => {
    expect(phaseOf(0, 1).left).toBeCloseTo(GREEN_ENDS - 1, 6);
    expect(phaseOf(0, AMBER_ENDS).left).toBeCloseTo(CYCLE - AMBER_ENDS, 6);
  });

  it("staggers junctions by their offset", () => {
    // Two lights 6 seconds apart must not be showing the same thing, or the
    // whole campus would change colour at once.
    expect(phaseOf(0, 0).phase).not.toBe(phaseOf(6, 0).phase);
  });

  it("copes with an offset that pushes the clock past a whole cycle", () => {
    expect(phaseOf(CYCLE * 3, 2).phase).toBe(phaseOf(0, 2).phase);
  });
});

describe("mayProceed", () => {
  it("lets a bus go only on green", () => {
    expect(mayProceed("green")).toBe(true);
    expect(mayProceed("red")).toBe(false);
  });

  it("treats amber as do-not-start", () => {
    // Pulling away on amber is the thing an amber light is telling you not
    // to do; the bus should already be waiting for the next green.
    expect(mayProceed("amber")).toBe(false);
  });
});

describe("stepBus at an ordinary stop", () => {
  it("brakes to a halt exactly at the stop, not past it", () => {
    const p = path();
    const st = bus();
    runUntilHalt(st, p);
    expect(st.s).toBe(p.cum[1]);
    expect(st.v).toBe(0);
  });

  it("never exceeds its cruising speed", () => {
    const p = path();
    const st = bus();
    let fastest = 0;
    for (let i = 0; i < 600; i++) {
      stepBus(st, p, 7.5, 1 / 60, 0, NO_SIGNALS);
      fastest = Math.max(fastest, st.v);
    }
    expect(fastest).toBeLessThanOrEqual(7.5 + 1e-9);
  });

  it("eases in rather than stopping dead", () => {
    // The old version ran at full speed right up to the stop and then snapped
    // to zero. So the telling number is the speed on the LAST frame it was
    // still moving: braking properly, that is nearly nothing; snapping, it is
    // still the full cruising speed.
    const p = path();
    const st = bus();
    const cruise = 7.5;
    let lastMoving = 0;
    for (let i = 0; i < 600 && !st.halted; i++) {
      stepBus(st, p, cruise, 1 / 60, 0, NO_SIGNALS);
      if (!st.halted && st.v > 0) lastMoving = st.v;
    }
    expect(st.halted).toBe(true);
    expect(lastMoving).toBeLessThan(cruise * 0.5);
  });

  it("slows down steadily over the approach, not all at once", () => {
    // Sample the speed at a few distances from the stop; each one closer in
    // must be slower than the last.
    const p = path();
    const st = bus();
    const cruise = 7.5;
    const at: Record<number, number> = {};
    for (let i = 0; i < 600 && !st.halted; i++) {
      stepBus(st, p, cruise, 1 / 60, 0, NO_SIGNALS);
      const gap = p.cum[1] - st.s;
      for (const mark of [3, 2, 1]) {
        if (at[mark] === undefined && gap <= mark) at[mark] = st.v;
      }
    }
    expect(at[3]).toBeGreaterThan(at[2]);
    expect(at[2]).toBeGreaterThan(at[1]);
    expect(at[1]).toBeLessThan(cruise);
  });

  it("pulls away again once the dwell is served", () => {
    const p = path();
    const st = bus();
    runUntilHalt(st, p);
    expect(st.node).toBe(1);
    // Still parked a moment before the dwell is up...
    run(st, p, DWELL - 0.2, NO_SIGNALS);
    expect(st.halted).toBe(true);
    // ...and moving shortly after.
    run(st, p, 0.4, NO_SIGNALS);
    expect(st.halted).toBe(false);
    expect(st.node).toBe(2);
  });

  it("gets back to the start after a full round", () => {
    const p = path();
    const st = bus();
    run(st, p, 200, NO_SIGNALS);
    expect(st.node).toBeGreaterThanOrEqual(1);
    expect(st.s).toBeGreaterThanOrEqual(0);
    expect(st.s).toBeLessThanOrEqual(p.cum[p.cum.length - 1]);
  });

  it("does not overshoot a stop on a long frame", () => {
    // A backgrounded tab hands back one huge delta; the bus must not jump
    // straight past a stop and carry on.
    const p = path();
    const st = bus({ v: 7.5 });
    for (let i = 0; i < 10; i++) stepBus(st, p, 7.5, 0.5, 0, NO_SIGNALS);
    expect(st.s).toBeLessThanOrEqual(p.cum[p.cum.length - 1]);
  });
});

describe("stepBus at a traffic light", () => {
  // Stop 2 has a light; everything else is a plain stop.
  const LIT = 2;
  const signalAt = (offset: number) => (id: number) =>
    id === LIT ? offset : null;

  /** Get a bus parked at the lit stop, with its dwell already served. */
  function parkedAtLight(offset: number, el: number) {
    const p = path();
    const st = bus({ s: p.cum[1], v: 0, node: 1, halted: true, wait: 0 });
    return { p, st, el, sig: signalAt(offset) };
  }

  it("stays put while the light is red", () => {
    // Offset chosen so the light is red for the whole window we watch.
    const el = AMBER_ENDS + 0.5;
    expect(phaseOf(0, el).phase).toBe("red");
    const { p, st, sig } = parkedAtLight(0, el);
    run(st, p, 2, sig, el);
    expect(st.halted).toBe(true);
    expect(st.node).toBe(1);
    expect(st.s).toBe(p.cum[1]);
  });

  it("stays put on amber too", () => {
    const el = GREEN_ENDS + 0.2;
    expect(phaseOf(0, el).phase).toBe("amber");
    const { p, st, sig } = parkedAtLight(0, el);
    // Watch only while it is still amber, so red cannot be what holds it.
    run(st, p, AMBER_ENDS - el - 0.05, sig, el);
    expect(st.halted).toBe(true);
    expect(st.node).toBe(1);
  });

  it("waits out a red even when the dwell finished long ago", () => {
    // This is the regression: a served dwell must not be enough on its own.
    const el = AMBER_ENDS + 0.1;
    const { p, st, sig } = parkedAtLight(0, el);
    st.wait = 0;
    run(st, p, CYCLE - AMBER_ENDS - 0.3, sig, el);
    expect(st.halted).toBe(true);
  });

  it("sets off once the light goes green", () => {
    const el = AMBER_ENDS + 0.5;
    const { p, st, sig } = parkedAtLight(0, el);
    expect(st.halted).toBe(true);
    // Long enough for the red to run out and the next green to arrive.
    run(st, p, CYCLE, sig, el);
    expect(st.node).toBeGreaterThan(1);
    expect(st.s).toBeGreaterThan(p.cum[1]);
  });

  it("leaves a stop with no light as soon as the dwell is done", () => {
    // The light at stop 2 must not somehow hold up stop 1.
    const el = AMBER_ENDS + 0.5; // red at the lit junction
    const p = path();
    const st = bus({ s: p.cum[2], v: 0, node: 2, halted: true, wait: 0 });
    run(st, p, 1, signalAt(0), el);
    expect(st.node).toBe(3);
  });

  it("never crosses the junction while its light is red", () => {
    // The strongest form of the rule: drive a full route for a minute and
    // check the bus is never found moving away from the lit stop on a red.
    const p = path();
    const st = bus();
    const sig = signalAt(1.7);
    const dt = 1 / 60;
    let el = 0;
    for (let i = 0; i < 60 * 60; i++) {
      stepBus(st, p, 7.5, dt, el, sig);
      el += dt;
      const leavingLight =
        p.nodeStops[st.node] === LIT && !st.halted && st.s > p.cum[st.node];
      expect(leavingLight).toBe(false);
    }
  });
});

describe("easeHeading", () => {
  it("moves towards the target instead of snapping to it", () => {
    const next = easeHeading(0, 1, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it("turns the short way across the +/-PI seam", () => {
    // From just under +PI to just over -PI is a small nudge, not a near-full
    // spin the other way round.
    const next = easeHeading(Math.PI - 0.1, -Math.PI + 0.1, 1 / 60);
    expect(next).toBeGreaterThan(Math.PI - 0.1);
  });

  it("arrives at the target when given a whole step", () => {
    expect(easeHeading(0, 1.2, 10)).toBeCloseTo(1.2, 6);
  });

  it("stays put when it is already facing the right way", () => {
    expect(easeHeading(0.7, 0.7, 1 / 60)).toBeCloseTo(0.7, 9);
  });
});

describe("braking distance", () => {
  it("is short enough that stops are not approached at a crawl", () => {
    // sqrt(2 * BRAKE * d) >= cruise means full speed is fine beyond d.
    const cruise = 7.5;
    const d = (cruise * cruise) / (2 * BRAKE);
    expect(d).toBeLessThan(5);
  });
});
