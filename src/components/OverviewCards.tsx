import { useEffect, useRef, useState } from "react";
import {
  stops,
  routes,
  buses,
  schedules,
  stopQueues,
  isPeakHour,
} from "../data/campusData";

interface Stat {
  label: string;
  value: number;
  hint: string;
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
  return (
    <div
      className="card p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <p className="text-xs uppercase tracking-wider text-slate-400">
        {stat.label}
      </p>
      <p className="stat-value mt-2 text-3xl font-semibold text-white">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{stat.hint}</p>
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
    { label: "Stops", value: stops.length, hint: "Campus nodes" },
    { label: "Routes", value: routes.length, hint: "Directed edges" },
    { label: "Buses", value: buses.length, hint: "Active fleet" },
    { label: "Schedules", value: schedules.length, hint: "Daily trips" },
    { label: "Peak Trips", value: peakCount, hint: "In peak windows" },
    { label: "Waiting", value: waiting, hint: "Passengers in queues" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat, i) => (
        <StatCard key={stat.label} stat={stat} index={i} />
      ))}
    </div>
  );
}
