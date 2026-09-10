import { useMemo } from "react";
import { stops, routes, stopName, stopChinese } from "../data/campusData";
import { useLang } from "../lib/i18n";

const CROWDED_THRESHOLD = 5;

interface Alert {
  id: string;
  level: "warning" | "info";
  en: string;
  zh: string;
}

// A service-alert strip, the way real transit apps surface disruptions:
// delayed segments and unusually crowded stops, derived from live data.
export default function ServiceAlerts() {
  const { lang } = useLang();

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];

    for (const r of routes) {
      if (r.delayMinutes > 0) {
        out.push({
          id: `delay-${r.id}`,
          level: "warning",
          en: `Delay of ${r.delayMinutes} min on ${stopName(r.sourceStopId)} → ${stopName(r.destinationStopId)}`,
          zh: `${stopChinese(r.sourceStopId)} → ${stopChinese(r.destinationStopId)} 延误 ${r.delayMinutes} 分钟`,
        });
      }
    }

    const crowded = stops.filter((s) => s.passengerCount >= CROWDED_THRESHOLD);
    for (const s of crowded) {
      out.push({
        id: `crowd-${s.id}`,
        level: "info",
        en: `${s.englishName} is busy — ${s.passengerCount} passengers waiting`,
        zh: `${s.chineseName} 客流较大 —— ${s.passengerCount} 人候车`,
      });
    }

    return out;
  }, []);

  if (alerts.length === 0) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300"
      >
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-400" />
        {lang === "zh" ? "所有线路运行正常" : "All lines running normally"}
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-2.5 rounded-2xl border px-4 py-2.5 text-sm ${
            a.level === "warning"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-brand-500/25 bg-brand-500/10 text-blue-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              a.level === "warning" ? "bg-amber-400" : "bg-brand-400"
            }`}
          />
          <span>{lang === "zh" ? a.zh : a.en}</span>
        </div>
      ))}
    </div>
  );
}
