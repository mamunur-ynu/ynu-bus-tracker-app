import { useState } from "react";
import { stops, routes, getStop } from "../data/campusData";
import { useLang } from "../lib/i18n";

interface RouteMapProps {
  highlightRouteIds: number[];
  delayedRouteId: number | null;
  pathStopIds: number[];
}

const MAP_IMAGE = "/ynu-campus-map.jpg";

// Campus map with an SVG overlay. The map image is the background and the
// SVG draws the routes on top of it. Stop markers are HTML elements placed
// with percentage coordinates so the labels stay sharp and readable.
export default function RouteMap({
  highlightRouteIds,
  delayedRouteId,
  pathStopIds,
}: RouteMapProps) {
  const { t, lang } = useLang();
  const [imageOk, setImageOk] = useState(true);

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-xl border border-slate-700/60 bg-ink-950"
        style={{ aspectRatio: "1080 / 701" }}
      >
        {imageOk ? (
          <img
            src={MAP_IMAGE}
            alt="Yunnan University Chenggong campus map"
            width={1080}
            height={701}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            onError={() => setImageOk(false)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ink-800 to-ink-950">
            <div className="max-w-sm px-6 text-center">
              <p className="text-sm font-medium text-slate-200">
                Campus map image not found
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Add the file <span className="text-brand-400">ynu-campus-map.jpg</span>{" "}
                into <span className="text-brand-400">visual_app/public/</span> to
                show the real campus map behind this route overlay.
              </p>
            </div>
          </div>
        )}

        {/* Route lines. preserveAspectRatio none maps percent coords to the image. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {routes.map((route) => {
            const from = getStop(route.sourceStopId);
            const to = getStop(route.destinationStopId);
            if (!from || !to) return null;

            const active = highlightRouteIds.includes(route.id);
            const delayed = delayedRouteId === route.id;
            const simulation = route.isSimulation === true;

            let stroke = "#e2e8f0";
            if (delayed) stroke = "#f87171";
            else if (simulation) stroke = active ? "#c4b5fd" : "#a78bfa";
            else if (active) stroke = "#2563eb";

            const width = active || delayed ? 1.1 : 0.5;
            let dash: string | undefined;
            if (delayed) dash = "2 1.5";
            else if (simulation) dash = "1.5 1.2";

            return (
              <line
                key={route.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={stroke}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={dash}
                opacity={active || delayed ? 1 : simulation ? 0.85 : 0.5}
              />
            );
          })}
        </svg>

        {/* Label for the simulation connector edges. */}
        {routes
          .filter((r) => r.isSimulation)
          .map((route) => {
            const from = getStop(route.sourceStopId);
            const to = getStop(route.destinationStopId);
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            return (
              <div
                key={route.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${midX}%`, top: `${midY}%` }}
              >
                <span className="whitespace-nowrap rounded bg-violet-500/85 px-1.5 py-0.5 text-[9px] font-medium text-white shadow">
                  {t("map.simconnector")}
                </span>
              </div>
            );
          })}

        {/* Stop markers as HTML so the bilingual labels stay crisp. */}
        {stops.map((stop) => {
          const onPath = pathStopIds.includes(stop.id);
          const waiting = stop.passengerCount ?? 0;
          return (
            <div
              key={stop.id}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${stop.x}%`, top: `${stop.y}%`, zIndex: onPath ? 20 : 10 }}
            >
              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-700 bg-ink-950/95 px-2.5 py-1.5 text-left shadow-xl group-hover:block">
                <p className="text-[11px] font-semibold text-white">
                  {lang === "zh" ? stop.chineseName : stop.englishName}
                </p>
                <p className="text-[10px] text-slate-400">
                  {lang === "zh" ? stop.englishName : stop.chineseName}
                </p>
                <p className="mt-0.5 text-[10px] text-brand-400">
                  {waiting} {t("home.waiting")}
                </p>
              </div>
              <div
                className="flex flex-col items-center"
                tabIndex={0}
                role="button"
                aria-label={`${stop.englishName} (${stop.chineseName}), ${waiting} passengers waiting`}
              >
                <span
                  className={`block rounded-full ring-2 transition-transform group-hover:scale-125 ${
                    onPath
                      ? "h-3.5 w-3.5 bg-brand-500 ring-brand-400"
                      : "h-2.5 w-2.5 bg-slate-200 ring-slate-500"
                  }`}
                />
                <span
                  className={`mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow ${
                    onPath
                      ? "bg-brand-500/90 text-white"
                      : "bg-ink-950/80 text-slate-200"
                  }`}
                >
                  {lang === "zh" ? stop.chineseName : stop.englishName}
                  <span className="block text-[9px] font-normal opacity-80">
                    {lang === "zh" ? stop.englishName : stop.chineseName}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-slate-300" /> Route
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-brand-500" /> Shortest path
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-6 bg-red-400"
            style={{ backgroundImage: "repeating-linear-gradient(90deg,#f87171 0 4px,transparent 4px 7px)" }}
          />{" "}
          Emergency delay
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-6"
            style={{ backgroundImage: "repeating-linear-gradient(90deg,#a78bfa 0 4px,transparent 4px 7px)" }}
          />{" "}
          {t("map.simconnector")}
        </span>
      </div>
    </div>
  );
}
