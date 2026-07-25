import { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";
import { busLines, routes, getStop } from "../data/campusData";
import { useLang } from "../lib/i18n";

// How fast the simulation clock runs: route-minutes advanced per real second.
// 0.4 => one route-minute every 2.5 seconds, so ETAs tick down believably.
const SIM_MIN_PER_SEC = 0.4;
// Fixed time for a bus to loop from its last stop back to the first.
const RETURN_MIN = 6;

// Travel minutes between two adjacent stops, from the route-board edges.
function segMinutes(a: number, b: number): number {
  const fwd = routes.find(
    (r) => r.sourceStopId === a && r.destinationStopId === b
  );
  if (fwd) return fwd.travelTimeMinutes;
  const rev = routes.find(
    (r) => r.sourceStopId === b && r.destinationStopId === a
  );
  return rev ? rev.travelTimeMinutes : 3;
}

interface LineModel {
  code: string;
  name: string;
  color: string;
  stopIds: number[];
  offsets: number[]; // cumulative arrival time (min) at each stop
  loopTotal: number;
}

function mmss(minutes: number): string {
  const total = Math.max(0, Math.round(minutes * 60));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// A simulated live-arrivals board. Each bus line runs a bus around its
// route-board loop; the ETA to every stop counts down in real time.
export default function LiveArrivals() {
  const { t, lang } = useLang();
  const startRef = useRef<number>(Date.now());
  const [, force] = useState(0);

  // Re-render on a steady tick so the countdowns move.
  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const id = window.setInterval(() => force((n) => n + 1), reduce ? 1000 : 500);
    return () => window.clearInterval(id);
  }, []);

  const models: LineModel[] = useMemo(
    () =>
      busLines.map((line) => {
        const offsets: number[] = [0];
        for (let i = 1; i < line.stopIds.length; i++) {
          offsets.push(
            offsets[i - 1] + segMinutes(line.stopIds[i - 1], line.stopIds[i])
          );
        }
        const loopTotal = offsets[offsets.length - 1] + RETURN_MIN;
        return {
          code: line.code,
          name: line.displayName,
          color: line.color,
          stopIds: line.stopIds,
          offsets,
          loopTotal,
        };
      }),
    []
  );

  const elapsedSec = (Date.now() - startRef.current) / 1000;

  const stopLabel = (id: number) => {
    const s = getStop(id);
    if (!s) return `#${id}`;
    return lang === "zh" ? s.chineseName : s.englishName;
  };

  return (
    <Card title={t("live.title")} subtitle={t("live.subtitle")}>
      <div className="grid gap-4 md:grid-cols-2">
        {models.map((line) => {
          const pos = (elapsedSec * SIM_MIN_PER_SEC) % line.loopTotal;
          // ETA to each stop, sorted by soonest.
          const upcoming = line.stopIds
            .map((id, i) => ({
              id,
              eta: (line.offsets[i] - pos + line.loopTotal) % line.loopTotal,
            }))
            .sort((a, b) => a.eta - b.eta);
          const next = upcoming[0];
          const then = upcoming.slice(1, 4);

          return (
            <div
              key={line.code}
              className="rounded-2xl border border-slate-700/50 bg-ink-950/40 p-4"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                <p className="text-sm font-semibold text-white">{line.name}</p>
                <span className="ml-auto rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {line.code}
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    {t("live.next")}
                  </p>
                  <p className="text-sm font-medium text-white">
                    {stopLabel(next.id)}
                  </p>
                </div>
                <p
                  className="font-display text-2xl font-bold tabular-nums"
                  style={{ color: line.color }}
                >
                  {next.eta < 0.25 ? t("live.now") : mmss(next.eta)}
                </p>
              </div>

              <div className="mt-3 space-y-1 border-t border-slate-800/70 pt-2">
                {then.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-xs text-slate-400"
                  >
                    <span>{stopLabel(s.id)}</span>
                    <span className="tabular-nums text-slate-300">
                      {mmss(s.eta)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
