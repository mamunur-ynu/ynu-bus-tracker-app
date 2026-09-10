import { describe, it, expect } from "vitest";
import {
  accuracyLevel,
  ageSeconds,
  bearingDegrees,
  distanceMeters,
  etaMinutes,
  formatDistance,
  freshness,
  headingDelta,
  interpolate,
  msToKmh,
  nearestStop,
} from "./geo";

// These are checked against distances I can verify independently rather than
// against whatever the code happened to return.

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    const p = { latitude: 24.82, longitude: 102.85 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it("matches a known one-degree-of-latitude distance", () => {
    // A degree of latitude is ~111.19 km anywhere on Earth.
    const d = distanceMeters(
      { latitude: 24, longitude: 102 },
      { latitude: 25, longitude: 102 }
    );
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  it("shrinks a degree of longitude by the cosine of the latitude", () => {
    // At 24.8°N a degree of longitude is ~111.19 * cos(24.8°) ~= 100.9 km.
    const d = distanceMeters(
      { latitude: 24.8, longitude: 102 },
      { latitude: 24.8, longitude: 103 }
    );
    expect(d / 1000).toBeGreaterThan(100);
    expect(d / 1000).toBeLessThan(102);
  });

  it("measures a short campus-scale hop sensibly", () => {
    // ~0.001° of latitude is about 111 m.
    const d = distanceMeters(
      { latitude: 24.8200, longitude: 102.8500 },
      { latitude: 24.8210, longitude: 102.8500 }
    );
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });

  it("is symmetric", () => {
    const a = { latitude: 24.82, longitude: 102.85 };
    const b = { latitude: 24.83, longitude: 102.86 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });
});

describe("bearingDegrees", () => {
  const here = { latitude: 24.82, longitude: 102.85 };

  it("points north", () => {
    expect(bearingDegrees(here, { latitude: 24.83, longitude: 102.85 })).toBeCloseTo(0, 1);
  });

  it("points east", () => {
    expect(bearingDegrees(here, { latitude: 24.82, longitude: 102.86 })).toBeCloseTo(90, 1);
  });

  it("points south", () => {
    expect(bearingDegrees(here, { latitude: 24.81, longitude: 102.85 })).toBeCloseTo(180, 1);
  });

  it("points west", () => {
    expect(bearingDegrees(here, { latitude: 24.82, longitude: 102.84 })).toBeCloseTo(270, 1);
  });

  it("always returns a compass bearing, never negative", () => {
    const b = bearingDegrees(here, { latitude: 24.819, longitude: 102.849 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("interpolate", () => {
  const a = { latitude: 24.82, longitude: 102.85 };
  const b = { latitude: 24.83, longitude: 102.86 };

  it("returns the ends at 0 and 1", () => {
    expect(interpolate(a, b, 0)).toEqual(a);
    expect(interpolate(a, b, 1)).toEqual(b);
  });

  it("lands halfway at 0.5", () => {
    const mid = interpolate(a, b, 0.5);
    expect(mid.latitude).toBeCloseTo(24.825, 6);
    expect(mid.longitude).toBeCloseTo(102.855, 6);
  });

  it("clamps out-of-range fractions so a late frame can't overshoot", () => {
    expect(interpolate(a, b, 1.8)).toEqual(b);
    expect(interpolate(a, b, -3)).toEqual(a);
  });
});

describe("headingDelta", () => {
  it("turns the short way across north", () => {
    // 350 -> 10 is a 20 degree right turn, not a 340 degree spin.
    expect(headingDelta(350, 10)).toBe(20);
  });

  it("turns the short way anticlockwise", () => {
    expect(headingDelta(10, 350)).toBe(-20);
  });

  it("is zero for no change", () => {
    expect(headingDelta(90, 90)).toBe(0);
  });

  it("never exceeds half a turn", () => {
    for (const [f, t] of [[0, 179], [0, 181], [270, 5], [45, 300]]) {
      expect(Math.abs(headingDelta(f, t))).toBeLessThanOrEqual(180);
    }
  });
});

describe("freshness", () => {
  it("calls a fresh fix live", () => {
    expect(freshness(2)).toBe("live");
  });

  it("marks a fix from half a minute ago as stale", () => {
    expect(freshness(30)).toBe("stale");
  });

  it("treats a minutes-old fix as lost rather than showing it as current", () => {
    // Showing a confident bus icon on a 5-minute-old position is how a rider
    // ends up waiting for a bus that already went past.
    expect(freshness(300)).toBe("lost");
  });
});

describe("ageSeconds", () => {
  it("measures how long ago a timestamp was", () => {
    const now = 1_800_000_000_000;
    expect(ageSeconds(new Date(now - 5000).toISOString(), now)).toBeCloseTo(5, 3);
  });

  it("never goes negative for a clock that is slightly ahead", () => {
    const now = 1_800_000_000_000;
    expect(ageSeconds(new Date(now + 4000).toISOString(), now)).toBe(0);
  });

  it("treats an unparsable timestamp as infinitely old, not as brand new", () => {
    expect(ageSeconds("not a date", 1_800_000_000_000)).toBe(Number.POSITIVE_INFINITY);
    expect(freshness(ageSeconds("not a date"))).toBe("lost");
  });
});

describe("accuracyLevel", () => {
  it("buckets a good fix as high", () => {
    expect(accuracyLevel(8)).toBe("high");
  });

  it("buckets a poor fix as low", () => {
    expect(accuracyLevel(120)).toBe("low");
  });

  it("says unknown rather than guessing when the device reports nothing", () => {
    expect(accuracyLevel(null)).toBe("unknown");
    expect(accuracyLevel(undefined)).toBe("unknown");
    expect(accuracyLevel(Number.NaN)).toBe("unknown");
  });
});

describe("etaMinutes", () => {
  it("computes a plain distance-over-speed estimate", () => {
    // 1000 m at 30 km/h = 2 minutes.
    expect(etaMinutes(1000, 30)).toBeCloseTo(2, 5);
  });

  it("does not return infinity for a bus stopped at a light", () => {
    // Speed 0 would divide by zero; the floor keeps the estimate usable.
    const eta = etaMinutes(1000, 0);
    expect(Number.isFinite(eta)).toBe(true);
    expect(eta).toBeGreaterThan(0);
  });

  it("ignores an implausible GPS speed spike", () => {
    // A momentary 500 km/h reading must not produce a 7-second ETA.
    const spiked = etaMinutes(5000, 500);
    const capped = etaMinutes(5000, 80);
    expect(spiked).toBeCloseTo(capped, 6);
  });

  it("handles a missing speed", () => {
    expect(Number.isFinite(etaMinutes(1000, null))).toBe(true);
  });
});

describe("msToKmh", () => {
  it("converts the Geolocation API's metres per second", () => {
    expect(msToKmh(10)).toBeCloseTo(36, 6);
  });

  it("passes through null when the device has no speed", () => {
    expect(msToKmh(null)).toBeNull();
    expect(msToKmh(-1)).toBeNull();
  });
});

describe("nearestStop", () => {
  const here = { latitude: 24.82, longitude: 102.85 };

  it("finds the closest calibrated stop", () => {
    const found = nearestStop(here, [
      { id: 1, latitude: 24.83, longitude: 102.85 },
      { id: 2, latitude: 24.8205, longitude: 102.85 },
    ]);
    expect(found?.stop.id).toBe(2);
    expect(found?.metres).toBeLessThan(100);
  });

  it("skips stops with no coordinates instead of guessing where they are", () => {
    const found = nearestStop(here, [
      { id: 1, latitude: null, longitude: null },
      { id: 2, latitude: 24.9, longitude: 102.9 },
    ]);
    expect(found?.stop.id).toBe(2);
  });

  it("returns null when nothing has been calibrated yet", () => {
    expect(nearestStop(here, [{ id: 1, latitude: null, longitude: null }])).toBeNull();
    expect(nearestStop(here, [])).toBeNull();
  });
});

describe("formatDistance", () => {
  it("rounds metres to something readable", () => {
    expect(formatDistance(847)).toBe("850 m");
  });

  it("switches to kilometres past 1 km", () => {
    expect(formatDistance(1240)).toBe("1.2 km");
  });

  it("shows a dash rather than NaN", () => {
    expect(formatDistance(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
