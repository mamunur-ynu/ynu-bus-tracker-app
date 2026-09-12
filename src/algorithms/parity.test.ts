import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { stops, routes } from "../data/campusData";
import { findShortestRoute } from "./dijkstra";

/*
 * Does the TypeScript Dijkstra agree with the C++ one?
 *
 * The web app is the companion to a C++ course project, and the obvious claim
 * to make about it - "same algorithm, different language" - is exactly the kind
 * of claim that is usually asserted and never checked. This checks it.
 *
 * Two things make the comparison meaningful rather than decorative.
 *
 * First, the two projects ship DIFFERENT DATA. The C++ repository's data files
 * are placeholders - Main Gate, Library, Cafeteria, six stops - while this app
 * carries the real Z52/Z53 route board with twelve. Running each on its own
 * data and comparing the output would compare the data, not the algorithms, and
 * would "pass" or "fail" for reasons that have nothing to do with either
 * implementation. So the fixture below is this app's graph, exported into the
 * C++ file format and fed to the C++ program.
 *
 * Second, the C++ side is the project's own findShortestRoute, compiled and
 * run - not a reimplementation of it, and not a transcription of what it
 * "should" print. A small harness links the real classes, calls the real
 * method, and captures its stdout for all 132 ordered stop pairs.
 *
 * The fixture is committed so this test runs anywhere, including CI, without
 * needing a C++ toolchain or the other repository. Regenerating it is
 * documented in the header of the fixture file itself.
 */

interface CppResult {
  found: boolean;
  path: number[];
  totalMinutes: number;
}

/** Parse the C++ program's console output into one result per stop pair. */
function parseCppOutput(text: string): Map<string, CppResult> {
  const out = new Map<string, CppResult>();
  // Anchored to the start of a line, and skipping "#" comments: the fixture's
  // own header documents the format and contains the word PAIR, which a loose
  // split happily counted as a 133rd result.
  const blocks = text
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .join("\n")
    .split(/^PAIR /m)
    .slice(1);
  for (const block of blocks) {
    const [header, ...rest] = block.split("\n");
    const [a, b] = header.trim().split(/\s+/).map(Number);
    const body = rest.join("\n");
    const key = `${a}->${b}`;

    if (/No path found/.test(body)) {
      out.set(key, { found: false, path: [], totalMinutes: 0 });
      continue;
    }
    // "  1 (YNU East Gate) -> 8 (School Hospital) -> ..."
    const pathLine = rest.find((l) => /^\s+\d+\s+\(/.test(l)) ?? "";
    const path = [...pathLine.matchAll(/(\d+)\s+\(/g)].map((m) => Number(m[1]));
    const minutes = Number(
      (body.match(/Total travel time:\s*([\d.]+)\s*min/) ?? [])[1] ?? NaN
    );
    out.set(key, { found: true, path, totalMinutes: minutes });
  }
  return out;
}

const FIXTURE = join(__dirname, "__fixtures__", "cpp-dijkstra-output.txt");
const FIXTURE_DELAYED = join(
  __dirname,
  "__fixtures__",
  "cpp-dijkstra-output-delayed.txt"
);

/** The same delays the delayed fixture was generated with. */
const DELAYS: Record<number, number> = { 1: 8, 4: 5, 7: 6 };

describe("C++ and TypeScript Dijkstra agree on the same graph", () => {
  if (!existsSync(FIXTURE)) {
    it.skip("fixture missing - see the file header for how to regenerate", () => {});
    return;
  }

  const cpp = parseCppOutput(readFileSync(FIXTURE, "utf8"));
  const ids = stops.map((s) => s.id).sort((a, b) => a - b);
  const pairs: Array<[number, number]> = [];
  for (const a of ids) for (const b of ids) if (a !== b) pairs.push([a, b]);

  it("covers every ordered pair of stops", () => {
    // 12 stops -> 12 * 11 = 132. If the campus data grows and the fixture is
    // not regenerated, this fails loudly instead of quietly testing less.
    expect(pairs).toHaveLength(132);
    expect(cpp.size).toBe(132);
  });

  it.each(pairs)("stop %i to stop %i", (from, to) => {
    const expected = cpp.get(`${from}->${to}`);
    expect(expected, `no C++ result recorded for ${from}->${to}`).toBeDefined();
    const actual = findShortestRoute(stops, routes, from, to);

    expect(actual.found).toBe(expected!.found);
    if (!expected!.found) return;

    // The path itself, not just its cost: two different routes can share a
    // total and still mean the algorithms disagree about which way to go.
    expect(actual.path).toEqual(expected!.path);
    expect(actual.totalMinutes).toBeCloseTo(expected!.totalMinutes, 6);
  });

  it("agrees about which stops are unreachable", () => {
    // YNU South Gate is on the map but on no route-board loop, so nothing can
    // reach it. Both implementations must say so rather than inventing a path.
    const unreachable = pairs.filter(([a, b]) => !cpp.get(`${a}->${b}`)!.found);
    expect(unreachable.length).toBeGreaterThan(0);
    for (const [a, b] of unreachable) {
      expect(findShortestRoute(stops, routes, a, b).found).toBe(false);
    }
  });

  it("uses the same edge weight rule as the C++ Route::edgeWeight", () => {
    // C++: travelTimeMinutes + delayMinutes. If one side ever stopped adding
    // the delay, most totals would still match on a graph with no delays -
    // so assert the rule directly rather than trusting the totals to catch it.
    const withDelay = routes.find((r) => r.delayMinutes > 0);
    if (!withDelay) {
      // No delayed edge in the fixture data; the rule is still asserted by
      // construction in dijkstra.ts and by its own unit tests.
      expect(routes.every((r) => r.delayMinutes === 0)).toBe(true);
      return;
    }
    const direct = findShortestRoute(
      stops,
      routes,
      withDelay.sourceStopId,
      withDelay.destinationStopId
    );
    expect(direct.totalMinutes).toBeGreaterThanOrEqual(
      withDelay.travelTimeMinutes + withDelay.delayMinutes
    );
  });
});

/*
 * The same comparison with emergency delays applied.
 *
 * This exists because of a mutation that got away. Deleting `delayMinutes`
 * from the TypeScript edge weight left all 132 pairs above still passing - not
 * because the test was weak about paths, but because every route in the
 * campus data has a delay of zero, so the two weight rules are identical on
 * that graph. Delay handling is a real feature (the Dijkstra tab lets you
 * apply one and watch the route change), so it needs a graph where it matters.
 */
describe("C++ and TypeScript agree once emergency delays are applied", () => {
  if (!existsSync(FIXTURE_DELAYED)) {
    it.skip("delayed fixture missing - see its header to regenerate", () => {});
    return;
  }

  const cpp = parseCppOutput(readFileSync(FIXTURE_DELAYED, "utf8"));
  const delayed = routes.map((r) => ({
    ...r,
    delayMinutes: DELAYS[r.id] ?? 0,
  }));

  const ids = stops.map((s) => s.id).sort((a, b) => a - b);
  const pairs: Array<[number, number]> = [];
  for (const a of ids) for (const b of ids) if (a !== b) pairs.push([a, b]);

  it("is actually a different problem from the undelayed one", () => {
    // If this ever stops being true the fixture has drifted and the delayed
    // run is quietly re-testing the same thing as the run above.
    const plain = findShortestRoute(stops, routes, 1, 2);
    const withDelay = findShortestRoute(stops, delayed, 1, 2);
    expect(withDelay.totalMinutes).toBeGreaterThan(plain.totalMinutes);
  });

  it.each(pairs)("delayed: stop %i to stop %i", (from, to) => {
    const expected = cpp.get(`${from}->${to}`);
    expect(expected, `no C++ result recorded for ${from}->${to}`).toBeDefined();
    const actual = findShortestRoute(stops, delayed, from, to);

    expect(actual.found).toBe(expected!.found);
    if (!expected!.found) return;
    expect(actual.path).toEqual(expected!.path);
    expect(actual.totalMinutes).toBeCloseTo(expected!.totalMinutes, 6);
  });
});
