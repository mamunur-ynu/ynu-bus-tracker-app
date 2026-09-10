import { useEffect, useMemo, useRef, useState } from "react";
import { buses, getStop, stops } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { useFavorites } from "../lib/favorites";
import {
  buildLineModels,
  minutesLeft,
  mmss,
  nextBusForStop,
  type LineModel,
} from "../lib/arrivals";

interface StudentHomeProps {
  /** Jump to the 3D city tab, so "track live bus" actually goes somewhere. */
  onTrackLive: () => void;
}

// How full a line's buses are, from the real onboard/capacity figures in
// campusData rather than an invented number.
function lineLoad(line: string): { pct: number; level: "low" | "medium" | "high" } {
  const fleet = buses.filter((b) => b.line === line);
  if (fleet.length === 0) return { pct: 0, level: "low" };
  const onboard = fleet.reduce((sum, b) => sum + b.onboardCount, 0);
  const capacity = fleet.reduce((sum, b) => sum + b.capacity, 0);
  const pct = capacity === 0 ? 0 : Math.round((onboard / capacity) * 100);
  return { pct, level: pct >= 75 ? "high" : pct >= 45 ? "medium" : "low" };
}

const loadStyles = {
  low: { dot: "#22c55e", text: "text-accent-400", key: "home.capacity.low" },
  medium: { dot: "#f59e0b", text: "text-amber-300", key: "home.capacity.medium" },
  high: { dot: "#f87171", text: "text-rose-300", key: "home.capacity.high" },
} as const;

// The student-facing landing screen: one clear answer to "when is my bus?",
// then the handful of stops this particular rider actually cares about.
export default function StudentHome({ onTrackLive }: StudentHomeProps) {
  const { t, lang } = useLang();
  const { favorites, toggleFavorite } = useFavorites();
  const startRef = useRef<number>(Date.now());
  const [, force] = useState(0);

  // Re-render on a steady tick so the countdown actually counts down.
  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const id = window.setInterval(() => force((n) => n + 1), reduce ? 1000 : 500);
    return () => window.clearInterval(id);
  }, []);

  const models: LineModel[] = useMemo(() => buildLineModels(), []);
  const elapsedSec = (Date.now() - startRef.current) / 1000;

  const stopLabel = (id: number) => {
    const s = getStop(id);
    if (!s) return `#${id}`;
    return lang === "zh" ? s.chineseName : s.englishName;
  };

  // Which stop the hero card is about: the rider's first favourite if they
  // have one, otherwise the busiest stop that a bus line actually serves.
  const servedStopIds = useMemo(
    () => new Set(models.flatMap((m) => m.stopIds)),
    [models]
  );
  const focusStopId = useMemo(() => {
    const pinned = favorites.find((id) => servedStopIds.has(id));
    if (pinned !== undefined) return pinned;
    const served = stops.filter((s) => servedStopIds.has(s.id));
    const busiest = [...served].sort(
      (a, b) => b.passengerCount - a.passengerCount
    )[0];
    return busiest ? busiest.id : served[0]?.id;
  }, [favorites, servedStopIds]);

  const next =
    focusStopId === undefined
      ? null
      : nextBusForStop(models, focusStopId, elapsedSec);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("home.morning");
    if (h < 18) return t("home.afternoon");
    return t("home.evening");
  };

  // "Busiest right now" is real passenger-queue data, not a guess at who is
  // physically nearby - the app has no location permission and the stop
  // coordinates are map percentages, not real-world latitude/longitude.
  const busiest = [...stops]
    .filter((s) => s.passengerCount > 0)
    .sort((a, b) => b.passengerCount - a.passengerCount)
    .slice(0, 4);

  const favouriteStops = favorites
    .map((id) => getStop(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
          {greeting()}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{t("home.welcome")}</p>
      </div>

      {/* Next bus hero card */}
      <div className="card overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-brand-500 to-accent-500" />
        <div className="p-5 sm:p-6">
          {next ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: next.line.color }}
                />
                <p className="text-sm font-semibold text-white">
                  {next.line.name}
                </p>
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {next.line.code}
                </span>
              </div>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    {t("home.arriving")}
                  </p>
                  <p className="font-display text-xl font-bold text-white sm:text-2xl">
                    {stopLabel(next.stopId)}
                  </p>
                </div>
                <div className="text-right">
                  {next.eta < 0.25 ? (
                    <p
                      className="font-display text-2xl font-extrabold sm:text-3xl"
                      style={{ color: next.line.color }}
                    >
                      {t("live.now")}
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] uppercase tracking-wider text-slate-500">
                        {t("live.arriving")}
                      </p>
                      <p
                        className="font-display font-extrabold leading-none"
                        style={{ color: next.line.color }}
                      >
                        <span className="text-4xl tabular-nums sm:text-5xl">
                          {minutesLeft(next.eta)}
                        </span>
                        <span className="ml-1.5 text-lg font-bold">
                          {t("home.min")}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Capacity, from the real fleet figures for this line */}
              {(() => {
                const load = lineLoad(next.line.code);
                const style = loadStyles[load.level];
                return (
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-800/70 pt-4">
                    <span className="text-[11px] uppercase tracking-wider text-slate-500">
                      {t("home.capacity")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: style.dot }}
                      />
                      <span className={`text-xs font-semibold ${style.text}`}>
                        {t(style.key)}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums text-slate-400">
                      {load.pct}%
                    </span>
                    <div
                      className="ml-auto h-1.5 w-24 overflow-hidden rounded-full bg-slate-700/60"
                      role="img"
                      aria-label={`${load.pct}%`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${load.pct}%`,
                          backgroundColor: style.dot,
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={onTrackLive}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-glow"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
                  <circle cx="12" cy="9.5" r="2.4" />
                </svg>
                {t("home.track")}
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-400">{t("home.nobus")}</p>
          )}
        </div>
      </div>

      {/* Favourite stops */}
      <div className="card p-5">
        <h3 className="card-title">{t("home.favourites")}</h3>
        {favouriteStops.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            {t("home.favourites.empty")}
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {favouriteStops.map((s) => {
              const bus = nextBusForStop(models, s.id, elapsedSec);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleFavorite(s.id)}
                  aria-label={`Remove ${s.englishName} from favourites`}
                  className="flex items-center gap-2 rounded-full border border-slate-700 bg-ink-950/40 px-3 py-1.5 text-xs text-slate-200 hover:border-brand-500/50"
                >
                  <span aria-hidden="true" className="text-amber-300">
                    ★
                  </span>
                  {lang === "zh" ? s.chineseName : s.englishName}
                  {bus && (
                    <span
                      className="tabular-nums font-semibold"
                      style={{ color: bus.line.color }}
                    >
                      {mmss(bus.eta)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Busiest stops, from the live passenger queues */}
      <div className="card p-5">
        <h3 className="card-title">{t("home.busiest")}</h3>
        {busiest.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">{t("home.quiet")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {busiest.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/70 px-3 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2 text-slate-200">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
                    <circle cx="12" cy="9.5" r="2.4" />
                  </svg>
                  {lang === "zh" ? s.chineseName : s.englishName}
                </span>
                <span className="text-xs tabular-nums text-slate-400">
                  {s.passengerCount} {t("home.waiting")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
