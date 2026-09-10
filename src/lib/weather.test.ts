import { describe, it, expect, vi, afterEach } from "vitest";
import {
  WEATHER_URL,
  describeCode,
  fetchWeather,
  isWet,
  parseWeather,
  ridingAdvice,
  type Weather,
} from "./weather";

// Weather comes from a third party, so the thing worth testing is not the
// happy path - it is every way the response can be wrong. A thrown TypeError
// on data.current.temperature_2m would take the whole dashboard down for a
// panel that is, at best, a nice extra.

/** A response shaped the way Open-Meteo documents it. */
const OK_RESPONSE = {
  latitude: 25.0,
  longitude: 102.75,
  timezone: "Asia/Shanghai",
  current_units: {
    temperature_2m: "°C",
    apparent_temperature: "°C",
    precipitation: "mm",
    weather_code: "wmo code",
    wind_speed_10m: "km/h",
  },
  current: {
    time: "2026-09-10T16:00",
    interval: 900,
    temperature_2m: 21.4,
    apparent_temperature: 20.8,
    precipitation: 0,
    weather_code: 3,
    wind_speed_10m: 8.2,
  },
  hourly_units: { precipitation_probability: "%" },
  hourly: {
    time: ["2026-09-10T16:00", "2026-09-10T17:00", "2026-09-10T18:00"],
    precipitation_probability: [10, 45, 30],
  },
};

const weather = (over: Partial<Weather> = {}): Weather => ({
  temperature: 20,
  feelsLike: 20,
  wind: 5,
  precipitation: 0,
  code: 0,
  rainChance: 0,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseWeather", () => {
  it("reads a well-formed response", () => {
    const w = parseWeather(OK_RESPONSE);
    expect(w).not.toBeNull();
    expect(w!.temperature).toBe(21.4);
    expect(w!.feelsLike).toBe(20.8);
    expect(w!.wind).toBe(8.2);
    expect(w!.code).toBe(3);
  });

  it("takes the worst chance of rain over the coming hours", () => {
    // 45% in an hour matters more than 10% right now - the rider is deciding
    // whether to carry an umbrella for the whole trip.
    expect(parseWeather(OK_RESPONSE)!.rainChance).toBe(45);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "not json"],
    ["a number", 42],
    ["an empty object", {}],
    ["an error body", { error: true, reason: "Invalid latitude" }],
    ["a missing current block", { hourly: { precipitation_probability: [5] } }],
    ["a current block that is not an object", { current: "warm" }],
  ])("returns null for %s instead of throwing", (_label, input) => {
    expect(parseWeather(input)).toBeNull();
  });

  it("refuses a response with no temperature", () => {
    const bad = { ...OK_RESPONSE, current: { weather_code: 3 } };
    expect(parseWeather(bad)).toBeNull();
  });

  it("refuses a response with no weather code", () => {
    const bad = { ...OK_RESPONSE, current: { temperature_2m: 20 } };
    expect(parseWeather(bad)).toBeNull();
  });

  it("rejects a temperature that is not a real number", () => {
    // JSON can carry null, and some APIs send strings for numbers.
    for (const t of [null, "21.4", NaN]) {
      const bad = { current: { temperature_2m: t, weather_code: 1 } };
      expect(parseWeather(bad)).toBeNull();
    }
  });

  it("falls back sensibly when the optional fields are missing", () => {
    const w = parseWeather({ current: { temperature_2m: 18, weather_code: 2 } });
    expect(w).not.toBeNull();
    // Feels-like defaults to the actual temperature rather than 0, which
    // would have read as a freezing day.
    expect(w!.feelsLike).toBe(18);
    expect(w!.wind).toBe(0);
    expect(w!.rainChance).toBeNull();
  });

  it("survives an hourly block full of nulls", () => {
    const w = parseWeather({
      current: { temperature_2m: 18, weather_code: 2 },
      hourly: { precipitation_probability: [null, null] },
    });
    expect(w!.rainChance).toBeNull();
  });
});

describe("describeCode", () => {
  it("names the common conditions in both languages", () => {
    expect(describeCode(0).en).toBe("Clear");
    expect(describeCode(0).zh).toBe("晴");
    expect(describeCode(61).en).toBe("Rain");
    expect(describeCode(95).en).toBe("Thunderstorm");
  });

  it("never returns an empty label, whatever the code", () => {
    // An unrecognised code must still render something rather than a blank.
    for (const code of [-1, 4, 30, 68, 90, 120]) {
      expect(describeCode(code).en.length).toBeGreaterThan(0);
      expect(describeCode(code).zh.length).toBeGreaterThan(0);
    }
  });
});

describe("isWet", () => {
  it("counts drizzle, rain, snow and showers as wet", () => {
    for (const code of [51, 61, 65, 71, 80, 86, 95, 99]) {
      expect(isWet(code)).toBe(true);
    }
  });

  it("counts clear, cloudy and fog as dry", () => {
    for (const code of [0, 1, 2, 3, 45, 48]) {
      expect(isWet(code)).toBe(false);
    }
  });
});

describe("ridingAdvice", () => {
  it("puts a thunderstorm above everything else", () => {
    // Worst-first ordering: a freezing thunderstorm must not be reported as
    // merely cold.
    const advice = ridingAdvice(weather({ code: 95, temperature: 2 }));
    expect(advice.en).toMatch(/thunderstorm/i);
  });

  it("tells a rider to take an umbrella when it is already raining", () => {
    expect(ridingAdvice(weather({ code: 61 })).en).toMatch(/umbrella/i);
  });

  it("warns about rain that has not started yet", () => {
    const advice = ridingAdvice(weather({ code: 3, rainChance: 70 }));
    expect(advice.en).toMatch(/70%/);
  });

  it("does not cry umbrella over a small chance of rain", () => {
    expect(ridingAdvice(weather({ code: 3, rainChance: 20 })).en).not.toMatch(
      /umbrella/i
    );
  });

  it("mentions the cold and the heat", () => {
    expect(ridingAdvice(weather({ temperature: 1 })).en).toMatch(/cold/i);
    expect(ridingAdvice(weather({ temperature: 33 })).en).toMatch(/hot/i);
  });

  it("always gives advice in both languages", () => {
    for (const w of [
      weather({ code: 95 }),
      weather({ code: 61 }),
      weather({ code: 45 }),
      weather({ temperature: 0 }),
      weather({ temperature: 35 }),
      weather(),
    ]) {
      const a = ridingAdvice(w);
      expect(a.en.length).toBeGreaterThan(0);
      expect(a.zh.length).toBeGreaterThan(0);
    }
  });

  it("copes with an unknown chance of rain", () => {
    expect(() => ridingAdvice(weather({ rainChance: null }))).not.toThrow();
  });
});

describe("fetchWeather", () => {
  it("asks for Kunming and no API key", () => {
    // A key in the URL would end up in the built JavaScript for anyone to
    // read; the whole point of choosing Open-Meteo is that there isn't one.
    expect(WEATHER_URL).toContain("latitude=25.0389");
    expect(WEATHER_URL).toContain("longitude=102.7183");
    expect(WEATHER_URL).not.toMatch(/api_?key|token|apikey/i);
  });

  it("returns the weather on a good response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => OK_RESPONSE })
    );
    const w = await fetchWeather();
    expect(w?.temperature).toBe(21.4);
  });

  it("returns null when the network is down", async () => {
    // The campus network blocking the API is a completely normal state and
    // must not throw into the component tree.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchWeather()).resolves.toBeNull();
  });

  it("returns null on an HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    );
    await expect(fetchWeather()).resolves.toBeNull();
  });

  it("returns null when the body is not JSON at all", async () => {
    // A captive portal or proxy answering with an HTML login page is the
    // classic version of this on a university network.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      })
    );
    await expect(fetchWeather()).resolves.toBeNull();
  });

  it("returns null when the JSON is fine but the shape is wrong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: true }) })
    );
    await expect(fetchWeather()).resolves.toBeNull();
  });
});
