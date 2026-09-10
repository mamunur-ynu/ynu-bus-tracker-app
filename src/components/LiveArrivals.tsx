import { useEffect, useMemo, useState } from "react";
import Card from "./Card";
import { getStop } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { useFavorites } from "../lib/favorites";
// The loop timing and ETA maths now live in one shared module so this board
// and the Home screen's "next bus" card can never drift apart.
import { arrivalsFor, buildLineModels, mmss, simElapsedSec } from "../lib/arrivals";

// A simulated live-arrivals board. Each bus line runs a bus around its
// route-board loop; the ETA to every stop counts down in real time.
export default function LiveArrivals() {
  const { t, lang } = useLang();
  const { favorites } = useFavorites();
  const [, force] = useState(0);

  // Re-render on a steady tick so the countdowns move.
  useEffect(() => {
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const id = window.setInterval(() => force((n) => n + 1), reduce ? 1000 : 500);
    return () => window.clearInterval(id);
  }, []);

  const models = useMemo(() => buildLineModels(), []);

  // Wall-clock, not "since this board opened", so every screen agrees.
  const elapsedSec = simElapsedSec();

  const stopLabel = (id: number) => {
    const s = getStop(id);
    if (!s) return `#${id}`;
    return lang === "zh" ? s.chineseName : s.englishName;
  };

  return (
    <Card title={t("live.title")} subtitle={t("live.subtitle")}>
      <div className="grid gap-4 md:grid-cols-2">
        {models.map((line) => {
          // ETA to each stop, sorted by soonest.
          const upcoming = arrivalsFor(line, elapsedSec);
          const next = upcoming[0];
          // Favourite stops are pinned above the rest of the list.
          const rest = upcoming.slice(1);
          const then = [
            ...rest.filter((s) => favorites.includes(s.id)),
            ...rest.filter((s) => !favorites.includes(s.id)),
          ].slice(0, 4);

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
                <p className="text-sm font-semibold text-white">{lang === "zh" ? line.nameZh : line.name}</p>
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
                    <span className="flex items-center gap-1.5">
                      {favorites.includes(s.id) && (
                        <span aria-label="favourite" className="text-amber-300">
                          ★
                        </span>
                      )}
                      {stopLabel(s.id)}
                    </span>
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
