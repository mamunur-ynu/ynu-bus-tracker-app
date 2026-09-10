import { describe, it, expect } from "vitest";
import { tripDuration, tripOffsets, tripProgress } from "./trip";

// The driver console shows "next stop" and a progress bar from these numbers,
// so the edges matter: the very start of a shift, the moment a bus is exactly
// at a stop, and the end of the line - where a trip must STOP rather than wrap
// around the way the rider-facing arrivals loop does.

// East Gate -> School Hospital -> Lixing -> Gewu, using real route-board times
// (3, 3, 2 minutes), so offsets are [0, 3, 6, 8].
const line = [1, 8, 7, 12];

describe("tripOffsets", () => {
  it("accumulates the real segment times", () => {
    expect(tripOffsets(line)).toEqual([0, 3, 6, 8]);
  });

  it("handles a single-stop line", () => {
    expect(tripOffsets([1])).toEqual([0]);
  });
});

describe("tripDuration", () => {
  it("is the time to the final stop", () => {
    expect(tripDuration(line)).toBe(8);
  });
});

describe("tripProgress", () => {
  it("starts at the first stop heading to the second", () => {
    const p = tripProgress(line, 0);
    expect(p.currentIndex).toBe(0);
    expect(p.nextIndex).toBe(1);
    expect(p.minutesToNext).toBe(3);
    expect(p.finished).toBe(false);
  });

  it("counts down to the next stop mid-segment", () => {
    const p = tripProgress(line, 1);
    expect(p.nextIndex).toBe(1);
    expect(p.minutesToNext).toBe(2);
  });

  it("advances once a stop is reached", () => {
    // Exactly at School Hospital: that stop is now "current", Lixing is next.
    const p = tripProgress(line, 3);
    expect(p.currentIndex).toBe(1);
    expect(p.nextIndex).toBe(2);
    expect(p.minutesToNext).toBe(3);
  });

  it("finishes at the terminus instead of looping back to the start", () => {
    // This is the difference from the arrivals board: a shift ends here.
    const p = tripProgress(line, 8);
    expect(p.finished).toBe(true);
    expect(p.currentIndex).toBe(line.length - 1);
    expect(p.nextIndex).toBe(line.length - 1);
    expect(p.fraction).toBe(1);
  });

  it("stays finished past the end rather than running backwards", () => {
    const p = tripProgress(line, 500);
    expect(p.finished).toBe(true);
    expect(p.fraction).toBe(1);
    expect(p.minutesToNext).toBe(0);
  });

  it("treats a negative clock as the very start", () => {
    // Clock skew shouldn't produce a bus that is somewhere before stop one.
    const p = tripProgress(line, -5);
    expect(p.currentIndex).toBe(0);
    expect(p.fraction).toBe(0);
    expect(p.finished).toBe(false);
  });

  it("reports a fraction that only moves forward", () => {
    const a = tripProgress(line, 2).fraction;
    const b = tripProgress(line, 5).fraction;
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("copes with a one-stop line", () => {
    const p = tripProgress([1], 0);
    expect(p.finished).toBe(true);
    expect(p.minutesToNext).toBe(0);
  });
});
