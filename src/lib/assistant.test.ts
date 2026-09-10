import { describe, it, expect, vi, afterEach } from "vitest";
import { askAssistant } from "./assistant";
import { stops, routes } from "../data/campusData";
import { arrivalAnswer, arrivalsSnapshot, localAnswer } from "./assistant";
import { getStop } from "../data/campusData";

// A fixed instant, so wording is deterministic instead of depending on where
// the simulated buses happen to be while the suite runs.
const NOW = 1_800_000_000_000;

const ask = (q: string, lang: "en" | "zh" = "en") =>
  localAnswer(q, stops, routes, lang, NOW);


// With no serverless function available (fetch fails), the assistant must
// still answer from the local rule-based parser.
const failingFetch = () => Promise.reject(new Error("offline"));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askAssistant local fallback", () => {
  it("computes a real route between two named stops", async () => {
    vi.stubGlobal("fetch", failingFetch);
    const r = await askAssistant(
      "How long from YNU East Gate to Engineering College?",
      stops,
      routes,
      "en"
    );
    expect(r.source).toBe("local");
    expect(r.text).toMatch(/minutes/);
    expect(r.text).toMatch(/Engineering College/);
  });

  it("answers the busiest-stop question", async () => {
    vi.stubGlobal("fetch", failingFetch);
    const r = await askAssistant("Which stop is busiest?", stops, routes, "en");
    expect(r.text).toMatch(/waiting/i);
  });

  it("asks for stops when none are recognised", async () => {
    vi.stubGlobal("fetch", failingFetch);
    const r = await askAssistant("hello there", stops, routes, "en");
    expect(r.text).toMatch(/start and a destination/i);
  });

  it("understands everyday nicknames like 'main gate'", async () => {
    vi.stubGlobal("fetch", failingFetch);
    const r = await askAssistant(
      "how long from the library to the main gate?",
      stops,
      routes,
      "en"
    );
    expect(r.text).toMatch(/minutes|Walk/);
  });

  it("suggests walking to the nearest served stop for unserved places", async () => {
    vi.stubGlobal("fetch", failingFetch);
    const r = await askAssistant(
      "i'm at qiu yuan 7, i want to go to the main gate",
      stops,
      routes,
      "en"
    );
    expect(r.text).toMatch(/Walk to the nearest stop/);
  });

  it("replies in Chinese when the language is zh", async () => {
    vi.stubGlobal("fetch", failingFetch);
    const r = await askAssistant("东门到图书馆要多久？", stops, routes, "zh");
    expect(r.text).toMatch(/分钟/);
  });
});

describe("asking when the next bus arrives", () => {
  // This is the question the assistant used to answer worst: with only one
  // stop named there was no route to compute, so it replied with the generic
  // "tell me a start and a destination" help text.
  it("answers a single-stop arrival question instead of asking for a destination", () => {
    const a = ask("When will the Library bus arrive?");
    expect(a).toMatch(/next bus to YNU Library|arriving at YNU Library/i);
    expect(a).not.toMatch(/Tell me a start and a destination/i);
  });

  it("names a real bus line rather than a made-up one", () => {
    const a = ask("when is the next bus at the library");
    expect(a).toMatch(/YNU Engineering Express|YNU Campus Connector/);
    expect(a).toMatch(/Z5[23]/);
  });

  it("works when the rider just names the stop", () => {
    const a = ask("library");
    expect(a).toMatch(/next bus to YNU Library|arriving at YNU Library/i);
  });

  it("answers in Chinese when asked in Chinese", () => {
    const a = ask("图书馆的下一班车什么时候到？", "zh");
    expect(a).toMatch(/图书馆/);
    expect(a).toMatch(/分钟|正在到达/);
  });

  it("mentions how many people are waiting when the stop is busy", () => {
    // YNU Library has real waiting passengers in the campus data.
    const a = ask("when is the next bus at the library");
    expect(a).toMatch(/people waiting|person waiting/i);
  });

  it("never invents a distance in metres", () => {
    // The app has no real positions, so a confident "700 m away" would be the
    // one part of the answer that is fabricated.
    const a = ask("when will the library bus arrive");
    expect(a).not.toMatch(/\bmetres?\b|\bmeters?\b|\bkm\b|\bm away\b/i);
  });
});

describe("the arrivals snapshot sent to the model", () => {
  // The serverless function cannot compute arrivals (it never receives the bus
  // lines), so the client sends them. If this ever drifts from the on-screen
  // engine the assistant starts quoting times that contradict the UI.
  const snap = arrivalsSnapshot(stops, NOW);

  it("covers every stop a bus line actually serves", () => {
    expect(snap.length).toBeGreaterThan(0);
    // Stop 3 is on the map but on no line, so it must be left out rather than
    // reported with a made-up time.
    expect(snap.some((a) => a.stopId === 3)).toBe(false);
  });

  it("agrees with the answer the rider sees for the same stop", () => {
    const library = snap.find((a) => a.stopId === 6);
    expect(library).toBeDefined();
    const spoken = arrivalAnswer(getStop(6)!, stops, routes, "en", NOW);
    // Same line and same number of minutes in both places.
    expect(spoken).toContain(library!.lineCode);
    expect(spoken).toMatch(new RegExp(`\\b${library!.minutes}\\b`));
  });

  it("only reports real bus lines", () => {
    for (const a of snap) {
      expect(a.lineCode).toMatch(/^Z5[23]$/);
      expect(a.minutes).toBeGreaterThan(0);
    }
  });
});

describe("stops no bus serves", () => {
  it("points at the nearest served stop instead of just saying no", () => {
    // YNU South Gate is a real stop but is not on either route-board loop.
    const south = getStop(3)!;
    const a = arrivalAnswer(south, stops, routes, "en", NOW);
    expect(a).toMatch(/No bus line stops at YNU South Gate/i);
    expect(a).toMatch(/nearest stop with a service is/i);
  });
});

describe("questions that are not about arrivals", () => {
  it("still routes between two stops", () => {
    const a = ask("How long from East Gate to the Library?");
    expect(a).toMatch(/takes about \d+ minutes/i);
    expect(a).toMatch(/Route:/);
  });

  it("still answers which stop is busiest", () => {
    const a = ask("Which stop is busiest?");
    expect(a).toMatch(/has the most people waiting/i);
  });

  it("still answers how many stops there are", () => {
    const a = ask("how many stops are there?");
    expect(a).toMatch(new RegExp(`${stops.length} stops`));
  });

  it("asks for the missing end of a route question rather than guessing", () => {
    // Directions were asked for, but only one end was named - the useful reply
    // is "starting from where?", not an arrival time they didn't ask about.
    const a = ask("how do I get to the library");
    expect(a).toMatch(/Which stop are you starting from/i);
    expect(a).not.toMatch(/next bus to/i);
  });

  it("still gives an arrival time if they ask when, even phrased as a route", () => {
    const a = ask("how long until the next bus gets to the library");
    expect(a).toMatch(/next bus to YNU Library|arriving at YNU Library/i);
  });

  it("falls back to help text when no stop is recognised", () => {
    const a = ask("what is the weather like");
    expect(a).toMatch(/Tell me a start and a destination/i);
  });
});
