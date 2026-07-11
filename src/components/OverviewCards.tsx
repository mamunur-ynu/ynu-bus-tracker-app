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
  value: number | string;
  hint: string;
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
      {stats.map((stat) => (
        <div key={stat.label} className="card p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            {stat.label}
          </p>
          <p className="stat-value mt-2 text-3xl font-semibold text-white">
            {stat.value}
          </p>
          <p className="mt-1 text-xs text-slate-500">{stat.hint}</p>
        </div>
      ))}
    </div>
  );
}
