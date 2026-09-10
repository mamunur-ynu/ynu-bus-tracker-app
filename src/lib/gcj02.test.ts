import { describe, it, expect } from "vitest";
import {
  gcj02ToWgs84,
  outsideChina,
  toAmapLngLat,
  wgs84ToGcj02,
  type LatLng,
} from "./gcj02";
import { distanceMeters } from "./geo";

// The whole point of this module is that getting it wrong is invisible: no
// error, no warning, just every bus drawn a few streets from where it is. So
// the tests are about the properties that must hold rather than a table of
// magic numbers - the algorithm is an approximation of an undisclosed official
// transform, and pinning it to reference values I cannot verify would be
// pretending to a precision nobody here can check.

const KUNMING: LatLng = { latitude: 25.0389, longitude: 102.7183 };
const BEIJING: LatLng = { latitude: 39.9042, longitude: 116.4074 };
const LONDON: LatLng = { latitude: 51.5072, longitude: -0.1276 };
const SYDNEY: LatLng = { latitude: -33.8688, longitude: 151.2093 };

describe("outsideChina", () => {
  it("knows Kunming and Beijing are inside", () => {
    expect(outsideChina(KUNMING)).toBe(false);
    expect(outsideChina(BEIJING)).toBe(false);
  });

  it("knows London and Sydney are outside", () => {
    expect(outsideChina(LONDON)).toBe(true);
    expect(outsideChina(SYDNEY)).toBe(true);
  });
});

describe("wgs84ToGcj02", () => {
  it("leaves points outside China exactly alone", () => {
    // Applying a China-only offset to a London coordinate would move a map
    // pin across the city for no reason at all.
    expect(wgs84ToGcj02(LONDON)).toEqual(LONDON);
    expect(wgs84ToGcj02(SYDNEY)).toEqual(SYDNEY);
  });

  it("actually shifts a point in Kunming", () => {
    const shifted = wgs84ToGcj02(KUNMING);
    expect(shifted.latitude).not.toBe(KUNMING.latitude);
    expect(shifted.longitude).not.toBe(KUNMING.longitude);
  });

  it("shifts it by a few hundred metres, not a few kilometres", () => {
    // The published offset inside China lands in roughly the 100-700m band.
    // A result outside that means the maths has gone wrong in a way that
    // would still look plausible on screen.
    const metres = distanceMeters(KUNMING, wgs84ToGcj02(KUNMING));
    expect(metres).toBeGreaterThan(100);
    expect(metres).toBeLessThan(1000);
  });

  it("gives the same answer every time", () => {
    // Deterministic: a bus must not jitter between frames because the
    // conversion wandered.
    expect(wgs84ToGcj02(KUNMING)).toEqual(wgs84ToGcj02(KUNMING));
  });

  it("moves nearby points by almost the same amount", () => {
    // Two stops 200m apart must stay 200m apart after conversion, or the
    // route drawn between them would bend.
    const a: LatLng = { latitude: 25.0389, longitude: 102.7183 };
    const b: LatLng = { latitude: 25.0407, longitude: 102.7183 };
    const before = distanceMeters(a, b);
    const after = distanceMeters(wgs84ToGcj02(a), wgs84ToGcj02(b));
    expect(Math.abs(after - before)).toBeLessThan(2);
  });
});

describe("gcj02ToWgs84", () => {
  it("gets back to where it started, within a metre", () => {
    for (const p of [KUNMING, BEIJING, { latitude: 31.2304, longitude: 121.4737 }]) {
      const round = gcj02ToWgs84(wgs84ToGcj02(p));
      expect(distanceMeters(p, round)).toBeLessThan(1);
    }
  });

  it("leaves points outside China alone", () => {
    expect(gcj02ToWgs84(LONDON)).toEqual(LONDON);
  });

  it("is a real inverse, not just a subtraction", () => {
    // Naively subtracting the offset computed at the shifted point leaves
    // several metres of error. The refinement pass is what removes it, and
    // this is the test that would fail if someone deleted that loop.
    const gcj = wgs84ToGcj02(KUNMING);
    const naive = {
      latitude: gcj.latitude - (wgs84ToGcj02(gcj).latitude - gcj.latitude),
      longitude: gcj.longitude - (wgs84ToGcj02(gcj).longitude - gcj.longitude),
    };
    const proper = gcj02ToWgs84(gcj);
    expect(distanceMeters(KUNMING, proper)).toBeLessThan(
      distanceMeters(KUNMING, naive)
    );
  });
});

describe("toAmapLngLat", () => {
  it("returns [longitude, latitude], which is Amap's order", () => {
    // Getting this backwards puts Kunming in the Indian Ocean, and it is an
    // easy mistake because every other API in this project takes lat first.
    const [lng, lat] = toAmapLngLat(KUNMING);
    expect(lng).toBeGreaterThan(100);
    expect(lng).toBeLessThan(105);
    expect(lat).toBeGreaterThan(24);
    expect(lat).toBeLessThan(26);
  });

  it("has already applied the offset", () => {
    const [lng, lat] = toAmapLngLat(KUNMING);
    expect(lat).not.toBe(KUNMING.latitude);
    expect(lng).not.toBe(KUNMING.longitude);
  });
});
