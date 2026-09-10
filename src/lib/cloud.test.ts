import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression test for the bug documented in CASE_STUDY.md: cloudFetch used
// to swallow a real Supabase query error and quietly return an empty list,
// which was indistinguishable from "the table is genuinely empty". A paused
// project (or a missing Row Level Security policy on just one table) then
// silently wiped the Live Editor for every visitor instead of showing an
// error. cloudFetch must now throw so the caller's try/catch can react.
const mockOrder = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: mockOrder,
      }),
    }),
  }),
}));

vi.mock("./supabaseConfig", () => ({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "a".repeat(30),
}));

const { cloudFetch } = await import("./cloud");

describe("cloudFetch", () => {
  beforeEach(() => {
    mockOrder.mockReset();
  });

  it("throws when the stops query fails, instead of returning an empty list", async () => {
    mockOrder
      .mockResolvedValueOnce({ data: null, error: { message: "permission denied for table stops" } })
      .mockResolvedValueOnce({ data: [], error: null });

    await expect(cloudFetch()).rejects.toThrow(/stops/i);
  });

  it("throws when the routes query fails", async () => {
    mockOrder
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "permission denied for table routes" } });

    await expect(cloudFetch()).rejects.toThrow(/routes/i);
  });

  it("returns the real rows when both queries succeed", async () => {
    mockOrder
      .mockResolvedValueOnce({
        data: [
          { id: 1, english_name: "YNU East Gate", chinese_name: "云南大学东门", x: 93, y: 52, passenger_count: 0 },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await cloudFetch();
    expect(result.stops).toEqual([
      {
        id: 1,
        englishName: "YNU East Gate",
        chineseName: "云南大学东门",
        x: 93,
        y: 52,
        passengerCount: 0,
        // A stop whose real position has not been captured yet reports null
        // rather than a default coordinate - "we don't know" has to stay
        // distinguishable from "it's at 0, 0 off the coast of Africa".
        latitude: null,
        longitude: null,
      },
    ]);
    expect(result.routes).toEqual([]);
  });

  it("carries real GPS coordinates through once a stop has been captured", async () => {
    mockOrder
      .mockResolvedValueOnce({
        data: [
          {
            id: 6,
            english_name: "YNU Library",
            chinese_name: "图书馆",
            x: 33,
            y: 56,
            passenger_count: 6,
            latitude: 24.8237,
            longitude: 102.8523,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await cloudFetch();
    expect(result.stops[0].latitude).toBeCloseTo(24.8237, 6);
    expect(result.stops[0].longitude).toBeCloseTo(102.8523, 6);
  });
});
