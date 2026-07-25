import { describe, it, expect, vi, afterEach } from "vitest";
import { askAssistant } from "./assistant";
import { stops, routes } from "../data/campusData";

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

  it("replies in Chinese when the language is zh", async () => {
    vi.stubGlobal("fetch", failingFetch);
    const r = await askAssistant("东门到图书馆要多久？", stops, routes, "zh");
    expect(r.text).toMatch(/分钟/);
  });
});
