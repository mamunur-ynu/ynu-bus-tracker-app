import { useCallback, useEffect, useRef, useState } from "react";
import { busLines, getStop, stops as seedStops, type Stop } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { cloudFetch, isCloudConfigured } from "../lib/cloud";
import { useLiveBuses } from "../lib/liveBuses";
import {
  ageSeconds,
  distanceMeters,
  etaMinutes,
  formatDistance,
  freshness,
  nearestStop,
} from "../lib/geo";
import { gcj02ToWgs84, toAmapLngLat } from "../lib/gcj02";
import {
  loadAmap,
  type AMapMap,
  type AMapOverlay,
  type AMapSdk,
  type AmapPoi,
  type WalkingStep,
} from "../lib/amap";

/** A stop that actually has real-world coordinates. */
type PlacedStop = Stop & { latitude: number; longitude: number };

function placed(list: Stop[]): PlacedStop[] {
  return list.filter(
    (s): s is PlacedStop =>
      typeof s.latitude === "number" && typeof s.longitude === "number"
  );
}

/**
 * The campus map, drawn on Amap's real map of Yunnan University.
 *
 * Three layers sit on top of each other here, and they have very different
 * provenance, which is worth keeping straight:
 *
 *  - Amap's own data: the buildings, roads, footpaths, dormitories and the
 *    POI database behind the search box. Real, and none of our doing.
 *  - The bus network: our route edges and stops. Real in the sense that they
 *    were read off the campus route board, but they can only be drawn here
 *    once someone has captured each stop's latitude and longitude on site.
 *  - Live buses: real GPS, published by a signed-in driver's phone.
 *
 * Every coordinate crossing into Amap is converted from WGS-84 to GCJ-02
 * first (see lib/gcj02) - without that the whole overlay sits a few hundred
 * metres from the map underneath it, and nothing warns you.
 */
export default function AmapCampus() {
  const { t, lang } = useLang();
  const mountRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<AMapSdk | null>(null);
  const mapRef = useRef<AMapMap | null>(null);
  const busMarkers = useRef<Map<number, AMapOverlay>>(new Map());
  const walkingRef = useRef<{ clear: () => void } | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [failure, setFailure] = useState("");
  const [stopList, setStopList] = useState<Stop[]>(seedStops);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AmapPoi[]>([]);
  const [searching, setSearching] = useState(false);
  const [walk, setWalk] = useState<{
    to: string;
    distance: number;
    minutes: number;
    steps: WalkingStep[];
    stop: string;
  } | null>(null);

  const { locations } = useLiveBuses();
  const withCoords = placed(stopList);

  // Stops come from the cloud when it is configured, because the bundled seed
  // has no coordinates - they are captured on site and saved to the database.
  useEffect(() => {
    if (!isCloudConfigured()) return;
    let live = true;
    cloudFetch()
      .then((d) => {
        if (live && d.stops.length) setStopList(d.stops);
      })
      .catch(() => {
        /* keep the seed; the map still renders, just without our stops */
      });
    return () => {
      live = false;
    };
  }, []);

  // ---- create the map once ----
  useEffect(() => {
    let disposed = false;
    loadAmap()
      .then((sdk) => {
        if (disposed || !mountRef.current) return;
        sdkRef.current = sdk;
        const map = new sdk.Map(mountRef.current, {
          zoom: 16,
          // Centre on the campus if we know where it is, otherwise on Kunming.
          // Deliberately not a hard-coded "YNU centre": this project has two
          // possible campuses and guessing one would put every new user in the
          // wrong place with no clue why.
          center: withCoords.length
            ? toAmapLngLat(withCoords[0])
            : [102.7183, 25.0389],
          viewMode: "2D",
          mapStyle: "amap://styles/dark",
        });
        map.addControl(new sdk.Scale());
        mapRef.current = map;
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (disposed) return;
        setFailure(err.message);
        setStatus("failed");
      });
    return () => {
      disposed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
    // Created once on purpose; later data changes are applied to the map
    // rather than rebuilding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- our own layer: routes and stops ----
  useEffect(() => {
    const sdk = sdkRef.current;
    const map = mapRef.current;
    if (!sdk || !map || status !== "ready" || withCoords.length === 0) return;

    const added: AMapOverlay[] = [];
    const byId = new Map(withCoords.map((s) => [s.id, s]));

    for (const line of busLines) {
      const path = line.stopIds
        .map((id) => byId.get(id))
        .filter((s): s is PlacedStop => Boolean(s))
        .map((s) => toAmapLngLat(s));
      if (path.length < 2) continue;
      const poly = new sdk.Polyline({
        path,
        strokeColor: line.color,
        strokeWeight: 6,
        strokeOpacity: 0.85,
        lineJoin: "round",
        showDir: true,
      });
      map.add(poly);
      added.push(poly);
    }

    for (const s of withCoords) {
      const marker = new sdk.Marker({
        position: toAmapLngLat(s),
        anchor: "center",
        content:
          `<div style="width:14px;height:14px;border-radius:50%;` +
          `background:#22c55e;border:3px solid #0b1220;` +
          `box-shadow:0 0 0 2px rgba(34,197,94,.45)"></div>`,
        title: lang === "zh" ? s.chineseName : s.englishName,
      });
      map.add(marker);
      added.push(marker);
    }

    map.setFitView(added, false, [40, 40, 40, 40]);
    return () => {
      for (const o of added) map.remove(o);
    };
  }, [status, withCoords, lang]);

  // ---- live buses ----
  useEffect(() => {
    const sdk = sdkRef.current;
    const map = mapRef.current;
    if (!sdk || !map || status !== "ready") return;

    const seen = new Set<number>();
    for (const [busId, loc] of locations) {
      seen.add(busId);
      const at = toAmapLngLat({ latitude: loc.latitude, longitude: loc.longitude });
      const stale = freshness(ageSeconds(loc.updatedAt)) !== "live";
      const existing = busMarkers.current.get(busId);
      if (existing) {
        existing.setPosition?.(at);
      } else {
        const marker = new sdk.Marker({
          position: at,
          anchor: "center",
          content:
            `<div style="display:flex;align-items:center;gap:6px">` +
            `<div style="width:18px;height:18px;border-radius:50%;` +
            `background:${stale ? "#94a3b8" : "#2563eb"};border:3px solid #0b1220;` +
            `box-shadow:0 0 12px ${stale ? "transparent" : "rgba(37,99,235,.9)"}"></div>` +
            `</div>`,
        });
        map.add(marker);
        busMarkers.current.set(busId, marker);
      }
    }
    // Drop markers for buses that stopped reporting.
    for (const [busId, marker] of busMarkers.current) {
      if (!seen.has(busId)) {
        map.remove(marker);
        busMarkers.current.delete(busId);
      }
    }
  }, [locations, status]);

  // ---- POI search over Amap's own campus data ----
  const search = useCallback(() => {
    const sdk = sdkRef.current;
    if (!sdk || !query.trim()) return;
    setSearching(true);
    setResults([]);
    const place = new sdk.PlaceSearch({
      // Kunming. Amap needs a city to search within, and without one a
      // dormitory name matches a hundred places across China.
      city: "昆明",
      citylimit: true,
      pageSize: 10,
    });
    place.search(query.trim(), (st, result) => {
      setSearching(false);
      if (st !== "complete") return;
      setResults(result.poiList?.pois ?? []);
    });
  }, [query]);

  /**
   * Walk the student from a place they searched for to the bus stop nearest
   * to it - which is the question the search is really being asked.
   */
  const routeToNearestStop = useCallback(
    (poi: AmapPoi) => {
      const sdk = sdkRef.current;
      const map = mapRef.current;
      if (!sdk || !map || !poi.location) return;

      // Amap answered in GCJ-02; our stops are stored as GPS, so come back to
      // WGS-84 before measuring any distance against them.
      const asGps = gcj02ToWgs84({
        latitude: poi.location.lat,
        longitude: poi.location.lng,
      });
      const near = nearestStop(asGps, withCoords);
      if (!near) return;

      walkingRef.current?.clear();
      const walking = new sdk.Walking({ map, hideMarkers: false });
      walkingRef.current = walking;
      walking.search(
        [poi.location.lng, poi.location.lat],
        toAmapLngLat(near.stop),
        (st, result) => {
          if (st !== "complete" || !result.routes?.length) return;
          const r = result.routes[0];
          setWalk({
            to: poi.name,
            distance: r.distance,
            minutes: Math.max(1, Math.round(r.time / 60)),
            steps: (r.steps ?? []).slice(0, 8),
            stop:
              lang === "zh"
                ? (near.stop as Stop).chineseName
                : (near.stop as Stop).englishName,
          });
        }
      );
    },
    [withCoords, lang]
  );

  // The soonest bus to that nearest stop, from real positions only.
  const busEta = (() => {
    if (withCoords.length === 0 || locations.size === 0) return null;
    let best: { line: string; minutes: number; metres: number } | null = null;
    for (const [, loc] of locations) {
      const near = nearestStop(
        { latitude: loc.latitude, longitude: loc.longitude },
        withCoords
      );
      if (!near) continue;
      const metres = distanceMeters(
        { latitude: loc.latitude, longitude: loc.longitude },
        near.stop
      );
      const minutes = etaMinutes(metres, loc.speedKmh);
      const label = getStop(near.stop.id);
      if (!best || minutes < best.minutes) {
        best = {
          line: (lang === "zh" ? label?.chineseName : label?.englishName) ?? "",
          minutes: Math.max(1, Math.round(minutes)),
          metres,
        };
      }
    }
    return best;
  })();

  const field =
    "w-full rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500";

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder={t("amap.searchph")}
            aria-label={t("amap.searchph")}
            className={`${field} flex-1 min-w-[12rem]`}
          />
          <button
            onClick={search}
            disabled={status !== "ready" || !query.trim()}
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {searching ? t("amap.searching") : t("amap.search")}
          </button>
        </div>

        {results.length > 0 && (
          <ul className="mt-3 space-y-1">
            {results.map((poi) => (
              <li key={poi.id}>
                <button
                  onClick={() => routeToNearestStop(poi)}
                  disabled={withCoords.length === 0}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/[0.04] disabled:opacity-40"
                >
                  <span className="text-sm text-slate-100">{poi.name}</span>
                  {poi.address && (
                    <span className="ml-2 text-xs text-slate-500">{poi.address}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {walk && (
          <div className="mt-3 rounded-xl border border-slate-800/70 p-3">
            <p className="text-sm text-slate-200">
              {t("amap.walkto")} <strong>{walk.stop}</strong> ·{" "}
              {formatDistance(walk.distance)} · {walk.minutes} {t("home.min")}
            </p>
            <ol className="mt-2 space-y-0.5 text-xs text-slate-400">
              {walk.steps.map((s, i) => (
                <li key={i}>{s.instruction}</li>
              ))}
            </ol>
            {busEta && (
              <p className="mt-2 text-xs text-accent-400">
                {t("amap.nextbus")}: {busEta.minutes} {t("home.min")} ·{" "}
                {formatDistance(busEta.metres)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div
          ref={mountRef}
          className="h-[440px] w-full bg-ink-950 md:h-[560px]"
          role="application"
          aria-label={t("amap.title")}
        />
      </div>

      {status === "loading" && (
        <p className="text-sm text-slate-400">{t("amap.loading")}</p>
      )}
      {status === "failed" && (
        <div className="card p-4">
          <p className="text-sm text-rose-300">{t("amap.failed")}</p>
          <p className="mt-1 text-xs text-slate-500">{failure}</p>
        </div>
      )}
      {/* The honest empty state. Without captured coordinates Amap draws a
          perfectly real campus with none of our stops on it, and a student
          would reasonably assume the app was broken rather than unfinished. */}
      {status === "ready" && withCoords.length === 0 && (
        <div className="card border-amber-500/30 p-4">
          <p className="text-sm text-amber-300">{t("amap.nostops")}</p>
          <p className="mt-1 text-xs text-slate-400">{t("amap.nostops.how")}</p>
        </div>
      )}
      {status === "ready" && withCoords.length > 0 && (
        <p className="text-xs text-slate-500">
          {withCoords.length}/{stopList.length} {t("amap.placed")}
        </p>
      )}
    </div>
  );
}
