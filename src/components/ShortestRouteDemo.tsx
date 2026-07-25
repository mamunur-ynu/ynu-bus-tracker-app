import { useMemo, useState } from "react";
import Card from "./Card";
import RouteMap from "./RouteMap";
import TripSteps from "./TripSteps";
import {
  stops,
  routes,
  busLines,
  DELAY_ROUTE_ID,
  stopName,
} from "../data/campusData";
import type { Route } from "../data/campusData";
import { findShortestRoute } from "../algorithms/dijkstra";

const DELAY_MINUTES = 10;

// Interactive demo of the shortest route search over the campus map.
// The result comes from the real Dijkstra function, not a fixed value.
export default function ShortestRouteDemo() {
  const [lineCode, setLineCode] = useState("Z52");
  const [sourceId, setSourceId] = useState(1);
  const [destId, setDestId] = useState(9);
  const [delayOn, setDelayOn] = useState(false);

  // Pick a bus line and set the source and destination to its two ends.
  function selectLine(code: string) {
    const line = busLines.find((l) => l.code === code);
    if (!line) return;
    setLineCode(code);
    setSourceId(line.stopIds[0]);
    setDestId(line.stopIds[line.stopIds.length - 1]);
  }

  // Build the working routes. When the delay is on, add minutes to route 5.
  const workingRoutes: Route[] = useMemo(() => {
    return routes.map((r) =>
      delayOn && r.id === DELAY_ROUTE_ID
        ? { ...r, delayMinutes: r.delayMinutes + DELAY_MINUTES }
        : { ...r }
    );
  }, [delayOn]);

  const result = useMemo(
    () => findShortestRoute(stops, workingRoutes, sourceId, destId),
    [workingRoutes, sourceId, destId]
  );

  const pathText = result.found
    ? result.path.map((id) => stopName(id)).join("  ->  ")
    : "No path found between the selected stops.";

  return (
    <Card
      title="Interactive Shortest Route"
      subtitle="Calculated by a Dijkstra function in TypeScript"
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <RouteMap
            highlightRouteIds={result.routeIds}
            delayedRouteId={delayOn ? DELAY_ROUTE_ID : null}
            pathStopIds={result.path}
          />
        </div>

        <div className="lg:col-span-2">
          <div className="mb-3">
            <span className="mb-1 block text-sm text-slate-400">Bus line</span>
            <div className="flex gap-2">
              {busLines.map((line) => (
                <button
                  key={line.code}
                  onClick={() => selectLine(line.code)}
                  className={`flex-1 rounded-lg px-3 py-2 text-left transition-colors ${
                    lineCode === line.code
                      ? "border border-brand-500/50 bg-brand-500/15 text-brand-400"
                      : "border border-slate-700 bg-ink-900 text-slate-300"
                  }`}
                >
                  <span className="block text-sm font-medium">
                    {line.displayName}
                  </span>
                  <span className="block text-xs opacity-70">
                    Official route code: {line.code}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-slate-400">From</span>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-ink-900 px-2 py-2 text-slate-100"
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.englishName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-400">To</span>
              <select
                value={destId}
                onChange={(e) => setDestId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-ink-900 px-2 py-2 text-slate-100"
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.englishName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={() => setDelayOn((v) => !v)}
            className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              delayOn
                ? "border border-red-400/40 bg-red-500/15 text-red-300"
                : "border border-brand-500/40 bg-brand-500/15 text-brand-400"
            }`}
          >
            {delayOn
              ? "Emergency delay is ON (YNU Library to Yuweitang, +10 min)"
              : "Apply emergency delay to YNU Library to Yuweitang (+10 min)"}
          </button>

          <div className="mt-4 rounded-xl border border-slate-700/50 bg-ink-950/40 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">
              Your trip
            </p>
            {result.found ? (
              <TripSteps
                path={result.path}
                routeIds={result.routeIds}
                totalMinutes={result.totalMinutes}
                workingRoutes={workingRoutes}
              />
            ) : (
              <p className="mt-1 text-sm font-medium text-white">{pathText}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
