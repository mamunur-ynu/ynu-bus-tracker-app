import Card from "./Card";
import {
  stops,
  routes,
  buses,
  schedules,
  formatTime,
  isPeakHour,
  lineNameIn,
  stopNameIn,
} from "../data/campusData";
import { useLang } from "../lib/i18n";

const th = "px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-400";
const td = "px-3 py-2 text-sm text-slate-200 border-t border-slate-800";

// Four data tables that match the C++ program records.
export default function DataTables() {
  const { t, lang } = useLang();
  // items-start: the stops table is much longer than the buses table, and
  // stretching them to match left the short one with a long empty tail.
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card title={t("table.stops")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>ID</th>
                <th className={th}>{t("table.name")}</th>
                <th className={th}>{t("table.waiting")}</th>
              </tr>
            </thead>
            <tbody>
              {stops.map((s) => (
                <tr key={s.id}>
                  <td className={td}>{s.id}</td>
                  <td className={td}>
                    {s.englishName}
                    <span className="ml-2 text-xs text-slate-400">
                      {s.chineseName}
                    </span>
                  </td>
                  <td className={td}>{s.passengerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("table.buses")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>{t("table.plate")}</th>
                <th className={th}>{t("table.capacity")}</th>
                <th className={th}>{t("table.onboard")}</th>
                <th className={th}>{t("table.usage")}</th>
                <th className={th}>{t("table.line")}</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((b) => (
                <tr key={b.id}>
                  <td className={td}>{b.plateNumber}</td>
                  <td className={td}>{b.capacity}</td>
                  <td className={td}>{b.onboardCount}</td>
                  <td className={td}>
                    {Math.round((b.onboardCount / b.capacity) * 100)}%
                  </td>
                  <td className={td}>
                    {lineNameIn(b.line, lang)}
                    <span className="ml-2 text-xs text-slate-400">{b.line}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("table.routes")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>ID</th>
                <th className={th}>{t("table.connection")}</th>
                <th className={th}>{t("table.time")}</th>
                <th className={th}>{t("table.weight")}</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.id}</td>
                  <td className={td}>
                    {stopNameIn(r.sourceStopId, lang)} → {stopNameIn(r.destinationStopId, lang)}
                    {r.isSimulation && (
                      <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                        {t("common.simulation")}
                      </span>
                    )}
                  </td>
                  <td className={td}>{r.travelTimeMinutes} {t("home.min")}</td>
                  <td className={td}>
                    {r.travelTimeMinutes + r.delayMinutes} {t("home.min")}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* note: weight equals travel time plus any delay, same as edgeWeight in C++ */}
          </table>
        </div>
      </Card>

      <Card title={t("table.schedules")}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>ID</th>
                <th className={th}>{t("table.line")}</th>
                <th className={th}>{t("table.bus")}</th>
                <th className={th}>{t("table.departure")}</th>
                <th className={th}>{t("table.arrival")}</th>
                <th className={th}>{t("table.peak")}</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className={td}>{s.id}</td>
                  <td className={td}>
                    {lineNameIn(s.line, lang)}
                    <span className="ml-2 text-xs text-slate-400">{s.line}</span>
                  </td>
                  <td className={td}>{s.busId}</td>
                  <td className={td}>{formatTime(s.departure)}</td>
                  <td className={td}>{formatTime(s.arrival)}</td>
                  <td className={td}>{t(isPeakHour(s.departure) ? "common.yes" : "common.no")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
