import { useEffect, useRef, useState } from "react";
import {
  stops,
  routes,
  buses,
  schedules,
  stopQueues,
  isPeakHour,
} from "../data/campusData";
import { useLang, type I18nKey } from "../lib/i18n";

interface Stat {
  labelKey: I18nKey;
  hintKey: I18nKey;
  value: number;
}

// Counts up from 0 to `target` once, respecting reduced-motion.
function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const value = useCountUp(stat.value);
  const { t } = useLang();
  return (
    <div
      className="card p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400">
        {t(stat.labelKey)}
      </p>
      <p className="stat-value mt-2 text-3xl font-semibold text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{t(stat.hintKey)}</p>
    </div>
  );
}

// Small metric cards that summarize the whole system.
export default function OverviewCards() {
  const peakCount = schedules.filter((s) => isPeakHour(s.departure)).length;
  const waiting = Object.values(stopQueues).reduce(
    (sum, list) => sum + list.length,
    0
  );

  const stats: Stat[] = [
    { labelKey: "stat.stops", hintKey: "stat.stops.hint", value: stops.length },
    { labelKey: "stat.routes", hintKey: "stat.routes.hint", value: routes.length },
    { labelKey: "stat.buses", hintKey: "stat.buses.hint", value: buses.length },
    { labelKey: "stat.schedules", hintKey: "stat.schedules.hint", value: schedules.length },
    { labelKey: "stat.peak", hintKey: "stat.peak.hint", value: peakCount },
    { labelKey: "stat.waiting", hintKey: "stat.waiting.hint", value: waiting },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat, i) => (
        <StatCard key={stat.labelKey} stat={stat} index={i} />
      ))}
    </div>
  );
}
