import { describe, it, expect } from "vitest";
import type { RideRating } from "./cloud";
import {
  RATE_COOLDOWN_HOURS,
  formatAverage,
  markRated,
  recentlyRated,
  starParts,
  summarise,
} from "./ratings";

const rating = (line: string, stars: number): RideRating => ({ line, stars });

/** A stand-in for localStorage that behaves, so the tests are deterministic. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  } as Storage;
}

/** Storage that throws on everything, like a locked-down private window. */
function brokenStorage(): Storage {
  const boom = () => {
    throw new Error("storage disabled");
  };
  return {
    length: 0,
    clear: boom,
    getItem: boom,
    key: boom,
    removeItem: boom,
    setItem: boom,
  } as unknown as Storage;
}

describe("summarise", () => {
  it("averages the ratings for a line", () => {
    const s = summarise([rating("Z52", 5), rating("Z52", 4)], ["Z52"]);
    expect(s[0].average).toBe(4.5);
    expect(s[0].count).toBe(2);
  });

  it("keeps the lines apart", () => {
    const s = summarise(
      [rating("Z52", 5), rating("Z53", 1), rating("Z53", 3)],
      ["Z52", "Z53"]
    );
    expect(s[0].average).toBe(5);
    expect(s[1].average).toBe(2);
  });

  it("reports an unrated line as null, not as zero", () => {
    // 0.0 out of 5 would read as "everyone hates this bus" when in fact
    // nobody has said anything at all.
    const s = summarise([], ["Z52"]);
    expect(s[0].average).toBeNull();
    expect(s[0].count).toBe(0);
  });

  it("still lists a line nobody rated", () => {
    const s = summarise([rating("Z52", 4)], ["Z52", "Z53"]);
    expect(s.map((x) => x.line)).toEqual(["Z52", "Z53"]);
  });

  it("counts each star value in the histogram", () => {
    const s = summarise(
      [rating("Z52", 1), rating("Z52", 5), rating("Z52", 5)],
      ["Z52"]
    );
    expect(s[0].histogram).toEqual([1, 0, 0, 0, 2]);
  });

  it("ignores star values outside 1 to 5", () => {
    // The CHECK constraint should stop these ever reaching the table, but a
    // rogue value must not corrupt the average or write past the histogram.
    const s = summarise(
      [rating("Z52", 0), rating("Z52", 9), rating("Z52", 4)],
      ["Z52"]
    );
    expect(s[0].count).toBe(1);
    expect(s[0].average).toBe(4);
    expect(s[0].histogram).toHaveLength(5);
  });
});

describe("formatAverage", () => {
  it("shows one decimal place", () => {
    expect(formatAverage(4.25)).toBe("4.3");
    expect(formatAverage(3)).toBe("3.0");
  });

  it("shows a dash when there is nothing to average", () => {
    expect(formatAverage(null)).toBe("–");
  });
});

describe("starParts", () => {
  it("rounds to the nearest half star", () => {
    expect(starParts(4.25)).toEqual({ full: 4, half: true });
    expect(starParts(4.1)).toEqual({ full: 4, half: false });
    expect(starParts(4.8)).toEqual({ full: 5, half: false });
  });

  it("draws nothing when there are no ratings", () => {
    expect(starParts(null)).toEqual({ full: 0, half: false });
  });

  it("never draws more than five stars", () => {
    const p = starParts(7);
    expect(p.full).toBe(5);
    expect(p.half).toBe(false);
  });

  it("never draws a negative number of stars", () => {
    expect(starParts(-3).full).toBe(0);
  });
});

describe("the rating cooldown", () => {
  it("does not block a line that has never been rated", () => {
    expect(recentlyRated("Z52", Date.now(), fakeStorage())).toBe(false);
  });

  it("blocks a second rating straight away", () => {
    const s = fakeStorage();
    const now = 1_800_000_000_000;
    markRated("Z52", now, s);
    expect(recentlyRated("Z52", now + 1000, s)).toBe(true);
  });

  it("lets the line be rated again once the cooldown passes", () => {
    const s = fakeStorage();
    const now = 1_800_000_000_000;
    markRated("Z52", now, s);
    const later = now + RATE_COOLDOWN_HOURS * 3600 * 1000 + 1;
    expect(recentlyRated("Z52", later, s)).toBe(false);
  });

  it("only blocks the line that was rated", () => {
    const s = fakeStorage();
    const now = Date.now();
    markRated("Z52", now, s);
    expect(recentlyRated("Z53", now, s)).toBe(false);
  });

  it("allows rating when storage throws instead of crashing the page", () => {
    // A private window that refuses storage must not take the card down.
    expect(() => recentlyRated("Z52", Date.now(), brokenStorage())).not.toThrow();
    expect(recentlyRated("Z52", Date.now(), brokenStorage())).toBe(false);
    expect(() => markRated("Z52", Date.now(), brokenStorage())).not.toThrow();
  });

  it("survives corrupted stored data", () => {
    const s = fakeStorage();
    s.setItem("ynu.rated", "{not json");
    expect(recentlyRated("Z52", Date.now(), s)).toBe(false);
    // And can recover by writing a fresh value over the top.
    expect(() => markRated("Z52", Date.now(), s)).not.toThrow();
  });

  it("ignores a stored value that is not a timestamp", () => {
    const s = fakeStorage();
    s.setItem("ynu.rated", JSON.stringify({ Z52: "yesterday" }));
    expect(recentlyRated("Z52", Date.now(), s)).toBe(false);
  });
});
