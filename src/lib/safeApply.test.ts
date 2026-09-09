import { describe, it, expect } from "vitest";
import { safeApply } from "./safeApply";

// Regression tests for the bug documented in CASE_STUDY.md: a paused
// Supabase project (or a Row Level Security gap) made a cloud fetch come
// back empty, and the Live Editor used to apply that empty result directly
// - wiping every stop and route off the screen for every visitor, even
// though nothing had actually been deleted.
describe("safeApply", () => {
  it("accepts a non-empty incoming list", () => {
    expect(safeApply([1, 2, 3], [4, 5])).toEqual([4, 5]);
  });

  it("accepts an empty incoming list when there was nothing to lose", () => {
    // First-ever load, or a genuinely empty cloud project: fine to show [].
    expect(safeApply([], [])).toEqual([]);
  });

  it("refuses to replace real data with an empty result", () => {
    // This is the exact scenario that broke production: the cloud fetch
    // failed (a paused project / a blocked query) and came back with [],
    // while the screen already had real stops on it.
    const current = [{ id: 1, englishName: "YNU East Gate" }];
    expect(safeApply(current, [])).toBe(current);
  });

  it("accepts an empty incoming list for one field even if unrelated to the other", () => {
    // safeApply is called independently for stops and routes, so an empty
    // routes result doesn't have to imply anything about stops or vice versa.
    const currentRoutes = [{ id: 1, name: "A to B" }];
    expect(safeApply(currentRoutes, [])).toBe(currentRoutes);
  });
});
