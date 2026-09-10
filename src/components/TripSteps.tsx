import { getStop, routes as allRoutes } from "../data/campusData";
import type { Route } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { useFavorites } from "../lib/favorites";

interface Props {
  path: number[];
  routeIds: number[];
  totalMinutes: number;
  workingRoutes?: Route[];
}

// Renders a route as a proper itinerary — board, ride each leg, alight —
// the way transit apps present a trip, instead of one flat arrow list.
export default function TripSteps({
  path,
  routeIds,
  totalMinutes,
  workingRoutes = allRoutes,
}: Props) {
  const { lang } = useLang();
  const { favorites, toggleFavorite } = useFavorites();
  const zh = lang === "zh";
  if (path.length === 0) return null;

  const label = (id: number) => {
    const s = getStop(id);
    if (!s) return `#${id}`;
    return zh ? s.chineseName : s.englishName;
  };
  const legMinutes = (i: number) => {
    const r = workingRoutes.find((x) => x.id === routeIds[i]);
    return r ? r.travelTimeMinutes + r.delayMinutes : null;
  };

  const last = path.length - 1;

  return (
    <ol className="mt-4 space-y-0">
      {path.map((stopId, i) => {
        const isFirst = i === 0;
        const isLast = i === last;
        const mins = isLast ? null : legMinutes(i);
        const starred = favorites.includes(stopId);

        return (
          <li key={`${stopId}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            {/* timeline rail */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[7px] top-4 h-full w-px bg-slate-700"
              />
            )}
            <span
              aria-hidden="true"
              className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                isFirst || isLast
                  ? "border-brand-400 bg-brand-500"
                  : "border-slate-600 bg-ink-950"
              }`}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-white">
                  {label(stopId)}
                </p>
                <button
                  onClick={() => toggleFavorite(stopId)}
                  aria-pressed={starred}
                  aria-label={
                    starred
                      ? `Remove ${label(stopId)} from favourites`
                      : `Add ${label(stopId)} to favourites`
                  }
                  // -m-2 p-2: grows the tap target to ~32px without moving
                  // the star or pushing the row apart. It measured 13x14,
                  // which is under half the 24px minimum and genuinely hard
                  // to hit with a thumb.
                  className={`-m-2 shrink-0 p-2 text-sm leading-none transition ${
                    starred ? "text-amber-300" : "text-slate-600 hover:text-slate-300"
                  }`}
                >
                  {starred ? "★" : "☆"}
                </button>
              </div>

              <p className="text-xs text-slate-500">
                {isFirst
                  ? zh ? "上车" : "Board here"
                  : isLast
                    ? zh ? "到达 · 下车" : "Arrive · get off"
                    : zh ? "途经" : "Pass through"}
                {mins !== null && (
                  <span className="ml-2 text-slate-400">
                    {zh ? `乘车 ${mins} 分钟` : `ride ${mins} min`}
                  </span>
                )}
              </p>
            </div>
          </li>
        );
      })}

      <li className="mt-1 border-t border-slate-800 pt-3 text-sm text-slate-400">
        {zh ? "总时长" : "Total"}{" "}
        <span className="font-semibold text-brand-400">
          {totalMinutes} {zh ? "分钟" : "min"}
        </span>
      </li>
    </ol>
  );
}
