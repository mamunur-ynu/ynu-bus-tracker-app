import { describe, it, expect } from "vitest";
import {
  RETURN_MIN,
  SIM_MIN_PER_SEC,
  arrivalsFor,
  buildLineModels,
  minutesLeft,
  mmss,
  nextBusForStop,
  segMinutes,
} from "./arrivals";

// The arrivals engine drives both the Live Arrivals board and the Home
// screen's "next bus" card, so a mistake here shows the wrong countdown in
// two places at once. These tests pin down the parts that are easy to get
// subtly wrong - above all the wrap-around, where a bus that has *just*
// left a stop must read as "a whole loop away", never as a negative ETA.

// Helper: the elapsed seconds needed to put a bus at `minutes` along its loop.
const secondsForLoopPosition = (minutes: number) => minutes / SIM_MIN_PER_SEC;

describe("segMinutes", () => {
  it("reads the travel time straight off a route-board edge", () => {
    // Route 1 in campusData: YNU East Gate (1) -> School Hospital (8), 3 min.
    expect(segMinutes(1, 8)).toBe(3);
  });

  it("reuses the same edge when travelling it backwards", () => {
    // There is no 8 -> 1 edge, but the bus still takes 3 minutes to drive it.
    expect(segMinutes(8, 1)).toBe(segMinutes(1, 8));
  });

  it("falls back to a default for a pair with no edge at all", () => {
    // Stop 3 has no route-board edge to stop 10; the loop must still be
    // computable rather than producing NaN and breaking every countdown.
    expect(segMinutes(3, 10)).toBe(3);
  });
});

describe("buildLineModels", () => {
  const models = buildLineModels();

  it("builds one model per bus line", () => {
    expect(models.length).toBeGreaterThan(0);
    expect(models.map((m) => m.code)).toContain("Z52");
  });

  it("starts each loop at zero and never goes backwards", () => {
    for (const line of models) {
      expect(line.offsets).toHaveLength(line.stopIds.length);
      expect(line.offsets[0]).toBe(0);
      for (let i = 1; i < line.offsets.length; i++) {
        expect(line.offsets[i]).toBeGreaterThan(line.offsets[i - 1]);
      }
    }
  });

  it("adds the return leg to the loop total", () => {
    for (const line of models) {
      const lastStop = line.offsets[line.offsets.length - 1];
      expect(line.loopTotal).toBe(lastStop + RETURN_MIN);
    }
  });
});

describe("arrivalsFor", () => {
  const models = buildLineModels();
  const line = models[0];

  it("lists every stop on the line, soonest first", () => {
    const arrivals = arrivalsFor(line, 0);
    expect(arrivals).toHaveLength(line.stopIds.length);
    for (let i = 1; i < arrivals.length; i++) {
      expect(arrivals[i].eta).toBeGreaterThanOrEqual(arrivals[i - 1].eta);
    }
  });

  it("puts the bus at the first stop when the clock starts", () => {
    const arrivals = arrivalsFor(line, 0);
    expect(arrivals[0].id).toBe(line.stopIds[0]);
    expect(arrivals[0].eta).toBe(0);
  });

  it("keeps every ETA inside a single loop", () => {
    const arrivals = arrivalsFor(line, secondsForLoopPosition(7.5));
    for (const a of arrivals) {
      expect(a.eta).toBeGreaterThanOrEqual(0);
      expect(a.eta).toBeLessThan(line.loopTotal);
    }
  });

  it("wraps a just-missed stop to nearly a full loop instead of going negative", () => {
    // Park the bus half a minute past the second stop. That stop is the one
    // the rider just missed: it should read as almost a whole loop away.
    const secondStopOffset = line.offsets[1];
    const arrivals = arrivalsFor(
      line,
      secondsForLoopPosition(secondStopOffset + 0.5)
    );
    const justMissed = arrivals.find((a) => a.id === line.stopIds[1]);
    expect(justMissed).toBeDefined();
    expect(justMissed!.eta).toBeCloseTo(line.loopTotal - 0.5, 5);
  });
});

describe("nextBusForStop", () => {
  const models = buildLineModels();

  it("returns the soonest line serving a shared stop", () => {
    // School Hospital (8) is on both lines, so the answer must be whichever
    // bus gets there first - not simply the first line in the list.
    const shared = 8;
    const elapsed = secondsForLoopPosition(5);
    const best = nextBusForStop(models, shared, elapsed);
    expect(best).not.toBeNull();

    const everyEta = models
      .filter((m) => m.stopIds.includes(shared))
      .map((m) => arrivalsFor(m, elapsed).find((a) => a.id === shared)!.eta);
    expect(best!.eta).toBeCloseTo(Math.min(...everyEta), 5);
  });

  it("returns null for a stop no line serves", () => {
    // YNU South Gate (3) is a real stop on the map but is not on either
    // route-board loop, so the Home card has to cope with "no bus here".
    expect(nextBusForStop(models, 3, 0)).toBeNull();
  });
});

describe("minutesLeft", () => {
  it("rounds up so it never under-promises", () => {
    // 9m40s left must read as 10, not 9 - a rider trusting "9" would be
    // standing at the stop a full minute before the bus.
    expect(minutesLeft(9.67)).toBe(10);
  });

  it("keeps a whole minute whole", () => {
    expect(minutesLeft(4)).toBe(4);
  });

  it("never counts down to zero", () => {
    // Below a minute the caller switches to "arriving now"; until then the
    // number shown should still be 1, never 0 or negative.
    expect(minutesLeft(0.3)).toBe(1);
    expect(minutesLeft(0)).toBe(1);
  });
});

describe("mmss", () => {
  it("pads the seconds", () => {
    expect(mmss(1.05)).toBe("1:03");
  });

  it("formats a whole number of minutes", () => {
    expect(mmss(4)).toBe("4:00");
  });

  it("never shows a negative countdown", () => {
    expect(mmss(-3)).toBe("0:00");
  });
});
