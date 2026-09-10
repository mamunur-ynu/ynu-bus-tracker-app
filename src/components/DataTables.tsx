import Card from "./Card";
import {
  stops,
  routes,
  buses,
  schedules,
  stopName,
  formatTime,
  isPeakHour,
  lineDisplayName,
} from "../data/campusData";

const th = "px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-400";
const td = "px-3 py-2 text-sm text-slate-200 border-t border-slate-800";

// Four data tables that match the C++ program records.
export default function DataTables() {
  // items-start: the stops table is much longer than the buses table, and
  // stretching them to match left the short one with a long empty tail.
  return (
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <Card title="Stops">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>ID</th>
                <th className={th}>Name</th>
                <th className={th}>Waiting</th>
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

      <Card title="Buses">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Plate</th>
                <th className={th}>Cap.</th>
                <th className={th}>Onboard</th>
                <th className={th}>Usage</th>
                <th className={th}>Line</th>
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
                    {lineDisplayName(b.line)}
                    <span className="ml-2 text-xs text-slate-400">{b.line}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Routes">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>ID</th>
                <th className={th}>Connection</th>
                <th className={th}>Time</th>
                <th className={th}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{r.id}</td>
                  <td className={td}>
                    {stopName(r.sourceStopId)} to {stopName(r.destinationStopId)}
                    {r.isSimulation && (
                      <span className="ml-2 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-300">
                        simulation
                      </span>
                    )}
                  </td>
                  <td className={td}>{r.travelTimeMinutes} min</td>
                  <td className={td}>
                    {r.travelTimeMinutes + r.delayMinutes} min
                  </td>
                </tr>
              ))}
            </tbody>
            {/* note: weight equals travel time plus any delay, same as edgeWeight in C++ */}
          </table>
        </div>
      </Card>

      <Card title="Schedules">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>ID</th>
                <th className={th}>Line</th>
                <th className={th}>Bus</th>
                <th className={th}>Departure</th>
                <th className={th}>Arrival</th>
                <th className={th}>Peak</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td className={td}>{s.id}</td>
                  <td className={td}>
                    {lineDisplayName(s.line)}
                    <span className="ml-2 text-xs text-slate-400">{s.line}</span>
                  </td>
                  <td className={td}>{s.busId}</td>
                  <td className={td}>{formatTime(s.departure)}</td>
                  <td className={td}>{formatTime(s.arrival)}</td>
                  <td className={td}>{isPeakHour(s.departure) ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
