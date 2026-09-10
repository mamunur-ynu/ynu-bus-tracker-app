import { describe, it, expect } from "vitest";
import { busLoad, fleetSummary, lineLoad, nextBusId } from "./fleet";
import type { Bus } from "../data/campusData";

const bus = (over: Partial<Bus> = {}): Bus => ({
  id: 1,
  plateNumber: "BUS-A",
  line: "Z52",
  capacity: 40,
  onboardCount: 0,
  active: true,
  ...over,
});

describe("busLoad", () => {
  it("reports the share of seats taken", () => {
    expect(busLoad(bus({ capacity: 40, onboardCount: 20 }))).toEqual({
      pct: 50,
      level: "medium",
    });
  });

  it("calls an almost-full bus high", () => {
    expect(busLoad(bus({ capacity: 40, onboardCount: 34 })).level).toBe("high");
  });

  it("calls a mostly-empty bus low", () => {
    expect(busLoad(bus({ capacity: 40, onboardCount: 8 })).level).toBe("low");
  });

  it("survives a bus with no capacity recorded", () => {
    // A row typed in wrong shouldn't divide by zero and render "NaN%".
    expect(busLoad(bus({ capacity: 0, onboardCount: 5 })).pct).toBe(0);
  });

  it("clamps an over-full bus to 100%", () => {
    // More riders than seats is bad data, but a 130%-wide progress bar
    // overflowing its container is a visible bug on top of it.
    expect(busLoad(bus({ capacity: 10, onboardCount: 13 })).pct).toBe(100);
  });
});

describe("lineLoad", () => {
  it("pools every bus running the line", () => {
    const fleet = [
      bus({ id: 1, line: "Z52", capacity: 40, onboardCount: 10 }),
      bus({ id: 2, line: "Z52", capacity: 60, onboardCount: 40 }),
    ];
    // 50 riders across 100 seats.
    expect(lineLoad(fleet, "Z52").pct).toBe(50);
  });

  it("ignores buses that are off the road", () => {
    // The parked bus's empty seats must not make the line look roomy: a
    // rider cannot board a bus that is in the depot.
    const fleet = [
      bus({ id: 1, line: "Z52", capacity: 40, onboardCount: 36, active: true }),
      bus({ id: 2, line: "Z52", capacity: 100, onboardCount: 0, active: false }),
    ];
    const load = lineLoad(fleet, "Z52");
    expect(load.pct).toBe(90);
    expect(load.level).toBe("high");
  });

  it("reports nothing rather than crashing for a line with no buses", () => {
    expect(lineLoad([], "Z99")).toEqual({ pct: 0, level: "low" });
  });
});

describe("fleetSummary", () => {
  it("splits the fleet into on-road and off-road", () => {
    const fleet = [
      bus({ id: 1, capacity: 40, onboardCount: 20, active: true }),
      bus({ id: 2, capacity: 40, onboardCount: 20, active: true }),
      bus({ id: 3, capacity: 50, onboardCount: 0, active: false }),
    ];
    const s = fleetSummary(fleet);
    expect(s.total).toBe(3);
    expect(s.active).toBe(2);
    expect(s.offRoad).toBe(1);
    // Seats and riders count only the two buses actually in service.
    expect(s.seats).toBe(80);
    expect(s.riders).toBe(40);
    expect(s.load.pct).toBe(50);
  });

  it("handles an empty fleet", () => {
    const s = fleetSummary([]);
    expect(s).toMatchObject({ total: 0, active: 0, offRoad: 0, seats: 0, riders: 0 });
    expect(s.load.pct).toBe(0);
  });
});

describe("nextBusId", () => {
  it("goes past the highest existing id", () => {
    expect(nextBusId([bus({ id: 3 }), bus({ id: 7 }), bus({ id: 5 })])).toBe(8);
  });

  it("starts at 1 for an empty fleet", () => {
    expect(nextBusId([])).toBe(1);
  });

  it("does not reuse the id of a deleted middle bus", () => {
    // Reusing 2 here would silently overwrite nothing today, but collides the
    // moment the deleted row is still in another open tab's copy of the fleet.
    expect(nextBusId([bus({ id: 1 }), bus({ id: 3 })])).toBe(4);
  });
});
