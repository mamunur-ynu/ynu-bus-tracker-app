import Card from "./Card";
import {
  stops,
  routes,
  buses,
  schedules,
  stopQueues,
  isPeakHour,
} from "../data/campusData";
import { useLang } from "../lib/i18n";

// Mirrors the content of the C++ generateReport function.
export default function ReportSummary() {
  const { t } = useLang();
  const peakCount = schedules.filter((s) => isPeakHour(s.departure)).length;

  // Find the most crowded stop from the sample queues.
  let crowdedStopId = -1;
  let crowdedSize = 0;
  for (const stop of stops) {
    const size = (stopQueues[stop.id] ?? []).length;
    if (size > crowdedSize) {
      crowdedSize = size;
      crowdedStopId = stop.id;
    }
  }
  const crowdedName =
    crowdedStopId === -1
      ? "none (all queues are empty)"
      : `${stops.find((s) => s.id === crowdedStopId)?.englishName} with ${crowdedSize} waiting passengers`;

  const delayedRoutes = routes.filter((r) => r.delayMinutes > 0);

  const recommendations: string[] = [];
  if (delayedRoutes.length > 0) {
    recommendations.push("Some routes are delayed. Suggest alternative routes.");
  }
  if (crowdedSize >= 5) {
    recommendations.push("The busiest stop is crowded. Add an extra bus.");
  }
  if (peakCount > 0) {
    recommendations.push(
      "Peak-hour service is active. Run buses more often in peak hours."
    );
  }
  if (recommendations.length === 0) {
    recommendations.push("The system looks balanced. No changes needed now.");
  }

  const rows = [
    { label: "Total stops", value: String(stops.length) },
    { label: "Total routes", value: String(routes.length) },
    { label: "Total buses", value: String(buses.length) },
    { label: "Total schedules", value: String(schedules.length) },
    { label: "Most crowded stop", value: crowdedName },
    {
      label: "Delayed routes",
      value: delayedRoutes.length === 0 ? "none" : String(delayedRoutes.length),
    },
    { label: "Peak-hour schedules", value: String(peakCount) },
  ];

  return (
    <Card title={t("report.title")} subtitle={t("report.subtitle")}>
      <dl className="divide-y divide-slate-800">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 py-2">
            <dt className="text-sm text-slate-400">{row.label}</dt>
            <dd className="text-sm font-medium text-slate-100 text-right">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wider text-slate-400">
          Optimization recommendations
        </p>
        <ul className="mt-2 space-y-1.5">
          {recommendations.map((rec, index) => (
            <li key={index} className="flex gap-2 text-sm text-slate-300">
              <span className="text-brand-400">-</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
