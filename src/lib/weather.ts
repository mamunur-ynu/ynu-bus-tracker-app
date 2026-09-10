// Current weather for the campus, from Open-Meteo.
//
// Open-Meteo is free and needs no API key, which matters for a student
// project: nothing to sign up for, nothing to leak, nothing to expire in the
// middle of a demo. The request is made straight from the browser.
//
// Honesty about what this is: Open-Meteo answers for a latitude and longitude,
// and the one below is the city of Kunming, not a sensor on campus. The UI
// says "Kunming" for that reason. It is real measured weather, but it is the
// city's weather, and calling it anything else would be a small lie.

/** Kunming, Yunnan - the city Yunnan University sits in. */
export const CAMPUS_LAT = 25.0389;
export const CAMPUS_LON = 102.7183;

export const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${CAMPUS_LAT}&longitude=${CAMPUS_LON}` +
  "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
  "&hourly=precipitation_probability&forecast_hours=6" +
  "&timezone=Asia%2FShanghai";

export interface Weather {
  /** Degrees Celsius. */
  temperature: number;
  /** What it feels like, degrees Celsius. */
  feelsLike: number;
  /** Kilometres per hour. */
  wind: number;
  /** Millimetres falling right now. */
  precipitation: number;
  /** WMO weather code. */
  code: number;
  /** Highest chance of rain over the next few hours, as a percentage. */
  rainChance: number | null;
}

/**
 * WMO weather interpretation codes.
 *
 * Open-Meteo returns a number, not a description, so the mapping has to live
 * somewhere. Grouped rather than exhaustive: a rider deciding whether to wait
 * outside does not need "moderate drizzle" told apart from "dense drizzle".
 */
export function describeCode(code: number): { en: string; zh: string } {
  if (code === 0) return { en: "Clear", zh: "晴" };
  if (code === 1) return { en: "Mostly clear", zh: "晴间多云" };
  if (code === 2) return { en: "Partly cloudy", zh: "多云" };
  if (code === 3) return { en: "Overcast", zh: "阴" };
  if (code === 45 || code === 48) return { en: "Fog", zh: "雾" };
  if (code >= 51 && code <= 57) return { en: "Drizzle", zh: "毛毛雨" };
  if (code >= 61 && code <= 67) return { en: "Rain", zh: "雨" };
  if (code >= 71 && code <= 77) return { en: "Snow", zh: "雪" };
  if (code >= 80 && code <= 82) return { en: "Rain showers", zh: "阵雨" };
  if (code === 85 || code === 86) return { en: "Snow showers", zh: "阵雪" };
  if (code >= 95) return { en: "Thunderstorm", zh: "雷雨" };
  return { en: "Unknown", zh: "未知" };
}

/** True when the sky is actively dropping something on you. */
export function isWet(code: number): boolean {
  return (code >= 51 && code <= 86) || code >= 95;
}

/**
 * One line of advice for someone about to stand at a bus stop.
 *
 * Deliberately about waiting for a bus rather than generic weather chatter -
 * that is the only reason this panel is in a transport app at all. The
 * thresholds are ordered worst-first so a thunderstorm is never described as
 * merely chilly.
 */
export function ridingAdvice(w: Weather): { en: string; zh: string } {
  if (w.code >= 95)
    return {
      en: "Thunderstorm - wait indoors until the bus arrives.",
      zh: "雷雨天气，请在室内等车。",
    };
  if (isWet(w.code))
    return { en: "Take an umbrella to the stop.", zh: "去站台请带伞。" };
  if (w.rainChance !== null && w.rainChance >= 50)
    return {
      en: `Rain likely soon (${w.rainChance}%) - an umbrella is worth it.`,
      zh: `稍后可能下雨（${w.rainChance}%），建议带伞。`,
    };
  if (w.code === 45 || w.code === 48)
    return {
      en: "Fog about - buses may run a little late.",
      zh: "有雾，公交可能稍有延误。",
    };
  if (w.temperature <= 5)
    return { en: "Cold at the stop - wrap up warm.", zh: "站台较冷，注意保暖。" };
  if (w.temperature >= 30)
    return {
      en: "Hot - wait in the shade and bring water.",
      zh: "天气炎热，请在阴凉处等候并补充水分。",
    };
  return { en: "Good weather for waiting outside.", zh: "适合户外等车。" };
}

/** Read a number out of unknown JSON, or null if it is not really a number. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Turn an Open-Meteo response into a Weather, or null if it is not usable.
 *
 * Every field is checked rather than trusted. This is the one part of the app
 * whose input comes from a third party that can change its response shape,
 * go down, or answer with an error body carrying HTTP 200 - and a thrown
 * TypeError on `data.current.temperature_2m` would take the whole dashboard
 * down with it. Returning null instead lets the panel say "unavailable" and
 * everything else carry on.
 */
export function parseWeather(data: unknown): Weather | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const current = root.current;
  if (!current || typeof current !== "object") return null;
  const c = current as Record<string, unknown>;

  const temperature = num(c.temperature_2m);
  const code = num(c.weather_code);
  // Temperature and the condition code are the two things the panel cannot
  // be drawn without; the rest can sensibly fall back.
  if (temperature === null || code === null) return null;

  let rainChance: number | null = null;
  const hourly = root.hourly;
  if (hourly && typeof hourly === "object") {
    const probs = (hourly as Record<string, unknown>).precipitation_probability;
    if (Array.isArray(probs)) {
      const valid = probs.map(num).filter((n): n is number => n !== null);
      if (valid.length > 0) rainChance = Math.round(Math.max(...valid));
    }
  }

  return {
    temperature,
    feelsLike: num(c.apparent_temperature) ?? temperature,
    wind: num(c.wind_speed_10m) ?? 0,
    precipitation: num(c.precipitation) ?? 0,
    code,
    rainChance,
  };
}

/**
 * Fetch the current weather. Resolves to null on any failure rather than
 * throwing, because no weather is a normal state for this panel - the campus
 * network may block it, the user may be offline, or the service may be down,
 * and none of those are worth an error boundary.
 */
export async function fetchWeather(
  signal?: AbortSignal
): Promise<Weather | null> {
  try {
    const res = await fetch(WEATHER_URL, { signal });
    if (!res.ok) return null;
    return parseWeather(await res.json());
  } catch {
    return null;
  }
}
