import { useCallback, useEffect, useState } from "react";
import { useLang } from "../lib/i18n";
import {
  describeCode,
  fetchWeather,
  isWet,
  ridingAdvice,
  type Weather,
} from "../lib/weather";

/** A small drawn icon per condition group. No icon font, no image requests. */
function WeatherIcon({ code }: { code: number }) {
  const stroke = { fill: "none", strokeWidth: 1.8, strokeLinecap: "round" as const };
  if (code === 0 || code === 1) {
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" fill="#fbbf24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line
            key={a}
            x1={12 + Math.cos((a * Math.PI) / 180) * 6.6}
            y1={12 + Math.sin((a * Math.PI) / 180) * 6.6}
            x2={12 + Math.cos((a * Math.PI) / 180) * 8.6}
            y2={12 + Math.sin((a * Math.PI) / 180) * 8.6}
            stroke="#fbbf24"
            {...stroke}
          />
        ))}
      </svg>
    );
  }
  const cloud = (
    <path
      d="M7 17h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.2A3.4 3.4 0 0 0 7 17z"
      fill="#93a7c4"
    />
  );
  if (code >= 95) {
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
        {cloud}
        <path d="M12.5 18l-2 3.4h3l-2 3.1" stroke="#fbbf24" {...stroke} />
      </svg>
    );
  }
  if (isWet(code)) {
    const snow = code >= 71 && code <= 77;
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
        {cloud}
        {[8.5, 12, 15.5].map((x, i) => (
          <line
            key={x}
            x1={x}
            y1={19 + (i % 2)}
            x2={snow ? x : x - 1.2}
            y2={22 + (i % 2)}
            stroke={snow ? "#e2e8f0" : "#60a5fa"}
            {...stroke}
          />
        ))}
      </svg>
    );
  }
  if (code === 45 || code === 48) {
    return (
      <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
        {cloud}
        {[19, 21.5].map((y) => (
          <line key={y} x1="6" y1={y} x2="18" y2={y} stroke="#93a7c4" {...stroke} />
        ))}
      </svg>
    );
  }
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="10" r="3.4" fill="#fbbf24" />
      {cloud}
    </svg>
  );
}

/**
 * Current conditions, framed around the one question a rider has: is it
 * pleasant to stand at the stop, or should I bring an umbrella?
 *
 * The panel has three states and all three are real: loading, weather, and
 * "unavailable". The last one is not a rare edge case - the campus network
 * or the browser being offline will produce it - so it gets a proper message
 * and a retry button rather than an empty box or a spinner that never stops.
 */
export default function WeatherPanel() {
  const { t, lang } = useLang();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    return fetchWeather(signal).then((w) => {
      if (signal?.aborted) return;
      setWeather(w);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    // Weather does not change minute to minute, and a student project should
    // not hammer a free service. Every fifteen minutes is plenty.
    const id = window.setInterval(() => load(), 15 * 60 * 1000);
    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, [load]);

  const pick = (pair: { en: string; zh: string }) =>
    lang === "zh" ? pair.zh : pair.en;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="card-title">{t("weather.title")}</h3>
        <span className="text-xs text-slate-400">{t("weather.source")}</span>
      </div>

      {loading && !weather ? (
        <p className="text-sm text-slate-400">{t("weather.loading")}</p>
      ) : !weather ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-400">{t("weather.unavailable")}</p>
          <button
            onClick={() => load()}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-brand-500/50"
          >
            {t("weather.retry")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <WeatherIcon code={weather.code} />
            <div>
              <p className="font-display text-3xl font-bold leading-none text-white">
                {Math.round(weather.temperature)}
                <span className="ml-0.5 text-xl">°C</span>
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {pick(describeCode(weather.code))}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-800/70 pt-3 text-xs text-slate-400">
            <span>
              {t("weather.feels")}{" "}
              <span className="tabular-nums text-slate-200">
                {Math.round(weather.feelsLike)}°C
              </span>
            </span>
            <span>
              {t("weather.wind")}{" "}
              <span className="tabular-nums text-slate-200">
                {Math.round(weather.wind)} km/h
              </span>
            </span>
            {weather.rainChance !== null && (
              <span>
                {t("weather.rain")}{" "}
                <span className="tabular-nums text-slate-200">
                  {weather.rainChance}%
                </span>
              </span>
            )}
          </div>

          <p className="mt-3 text-sm text-slate-300">
            {pick(ridingAdvice(weather))}
          </p>
        </>
      )}
    </div>
  );
}
