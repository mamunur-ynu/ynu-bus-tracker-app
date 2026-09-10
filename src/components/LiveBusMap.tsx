import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Card from "./Card";
import { busLines, stops as seedStops, type Stop } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { useFleet } from "../lib/fleet";
import { useLiveBuses } from "../lib/liveBuses";
import type { BusLocation } from "../lib/cloud";
import {
  ageSeconds,
  bearingDegrees,
  distanceMeters,
  etaMinutes,
  formatDistance,
  freshness,
  headingDelta,
  interpolate,
  nearestStop,
  type LatLng,
} from "../lib/geo";

// Kunming, Chenggong. Only the opening view before any bus reports in - it is
// never presented as a bus position.
const CAMPUS_FALLBACK: LatLng = { latitude: 24.8237, longitude: 102.8523 };

// The tile source is configurable because this app is used in mainland China,
// where OpenStreetMap's servers are often slow or unreachable. Swapping to a
// provider that works well there (or to Mapbox) is then a config change, not a
// code change: set VITE_MAP_TILE_URL and VITE_MAP_TILE_ATTRIBUTION.
const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL ??
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ?? "&copy; OpenStreetMap contributors";

const lineColor = (code: string) =>
  busLines.find((l) => l.code === code)?.color ?? "#2563eb";

// A marker that slides toward each new fix instead of teleporting, and turns
// to face the way it is going. Uber-style smoothness is not decoration here:
// a jumping icon makes it genuinely hard to tell which way the bus is headed.
interface Animated {
  marker: L.Marker;
  from: LatLng;
  to: LatLng;
  startedAt: number;
  durationMs: number;
  heading: number;
}

function busIcon(color: string, label: string, heading: number, dim: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div style="position:relative;width:44px;height:44px;opacity:${dim ? 0.45 : 1};">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
                    transform:rotate(${heading}deg);transition:transform .4s ease-out;">
          <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="${color}" opacity="0.25"/>
            <circle cx="12" cy="12" r="8" fill="${color}"/>
            <path d="M12 5.5 L15 13 L12 11.4 L9 13 Z" fill="#fff"/>
          </svg>
        </div>
        <div style="position:absolute;top:100%;left:50%;transform:translateX(-50%);
                    margin-top:2px;white-space:nowrap;font:600 10px/1 Inter,sans-serif;
                    color:#e2e8f0;background:rgba(11,17,32,.85);padding:2px 5px;border-radius:5px;">
          ${label}
        </div>
      </div>`,
  });
}

/**
 * The live tracking map: real GPS positions from the drivers' phones, drawn on
 * a real map.
 *
 * OpenStreetMap tiles, so there is no API key to obtain and nothing to bill.
 * The tile URL is the only thing that would change to move to Mapbox.
 */
export default function LiveBusMap({ stops = seedStops }: { stops?: Stop[] }) {
  const { t, lang } = useLang();
  const { fleet } = useFleet();
  const { locations, realtime } = useLiveBuses();

  const mountRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const busMarkers = useRef<Map<number, Animated>>(new Map());
  const meMarker = useRef<L.Marker | null>(null);
  const framerRef = useRef<number | null>(null);
  const fittedRef = useRef(false);

  const [selected, setSelected] = useState<number | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [tilesBroken, setTilesBroken] = useState(false);
  const [, tick] = useState(0);

  // Re-render once a second so "last seen 12s ago" actually counts up.
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const calibratedStops = useMemo(
    () => stops.filter((s) => s.latitude != null && s.longitude != null),
    [stops]
  );

  // --- set the map up once -------------------------------------------------
  useEffect(() => {
    if (!mountRef.current || mapRef.current) return;
    const map = L.map(mountRef.current, {
      center: [CAMPUS_FALLBACK.latitude, CAMPUS_FALLBACK.longitude],
      zoom: 15,
      zoomControl: true,
      attributionControl: true,
    });
    const tiles = L.tileLayer(TILE_URL, {
      maxZoom: 19,
      attribution: TILE_ATTRIBUTION,
    }).addTo(map);
    mapRef.current = map;

    // If the tile server cannot be reached the map is just a dark rectangle
    // with a bus icon floating on it, which looks broken rather than
    // explaining itself. Count failures and say so - the live positions are
    // still perfectly good even when the basemap is unavailable.
    let failed = 0;
    tiles.on("tileerror", () => {
      failed += 1;
      if (failed >= 4) setTilesBroken(true);
    });
    tiles.on("tileload", () => setTilesBroken(false));

    // Leaflet measures the container on creation; inside a tab that was hidden
    // it reads zero and renders a grey box until told to look again.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mountRef.current);
    window.setTimeout(() => map.invalidateSize(), 60);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      busMarkers.current.clear();
    };
  }, []);

  // --- draw the stops that have real coordinates ---------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    for (const s of calibratedStops) {
      L.circleMarker([s.latitude as number, s.longitude as number], {
        radius: 5,
        color: "#94a3b8",
        weight: 2,
        fillColor: "#0b1120",
        fillOpacity: 1,
      })
        .bindTooltip(lang === "zh" ? s.chineseName : s.englishName, {
          direction: "top",
        })
        .addTo(layer);
    }
    return () => {
      layer.remove();
    };
  }, [calibratedStops, lang]);

  // --- keep a marker per broadcasting bus ----------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<number>();
    for (const loc of locations.values()) {
      seen.add(loc.busId);
      const bus = fleet.find((b) => b.id === loc.busId);
      const label = bus?.plateNumber ?? `#${loc.busId}`;
      const color = lineColor(bus?.line ?? "");
      const target: LatLng = { latitude: loc.latitude, longitude: loc.longitude };
      const stale = freshness(ageSeconds(loc.updatedAt)) !== "live";

      const existing = busMarkers.current.get(loc.busId);
      if (!existing) {
        const marker = L.marker([target.latitude, target.longitude], {
          icon: busIcon(color, label, loc.heading ?? 0, stale),
        })
          .addTo(map)
          .on("click", () => setSelected(loc.busId));
        busMarkers.current.set(loc.busId, {
          marker,
          from: target,
          to: target,
          startedAt: performance.now(),
          durationMs: 0,
          heading: loc.heading ?? 0,
        });
      } else {
        // Slide from wherever it is now to the new fix. If the device gave no
        // heading (it doesn't when stationary), derive one from the movement.
        const current = existing.marker.getLatLng();
        const fromNow: LatLng = { latitude: current.lat, longitude: current.lng };
        const moved = distanceMeters(fromNow, target);
        const derived =
          loc.heading ?? (moved > 3 ? bearingDegrees(fromNow, target) : existing.heading);
        existing.from = fromNow;
        existing.to = target;
        existing.startedAt = performance.now();
        // Match the publish interval so the glide finishes about when the next
        // fix lands, rather than stuttering or lagging behind.
        existing.durationMs = moved > 0 ? 3000 : 0;
        existing.heading = existing.heading + headingDelta(existing.heading, derived);
        existing.marker.setIcon(busIcon(color, label, existing.heading, stale));
      }
    }

    // Drop markers for buses that stopped reporting entirely.
    for (const [id, a] of busMarkers.current) {
      if (!seen.has(id)) {
        a.marker.remove();
        busMarkers.current.delete(id);
        if (selected === id) setSelected(null);
      }
    }

    if (!fittedRef.current && locations.size > 0) {
      const pts = [...locations.values()].map(
        (l) => [l.latitude, l.longitude] as [number, number]
      );
      map.fitBounds(L.latLngBounds(pts).pad(0.4), { maxZoom: 17 });
      fittedRef.current = true;
    }
  }, [locations, fleet, selected]);

  // --- one animation loop drives every marker ------------------------------
  useEffect(() => {
    const step = () => {
      const now = performance.now();
      for (const a of busMarkers.current.values()) {
        if (a.durationMs <= 0) continue;
        const k = Math.min(1, (now - a.startedAt) / a.durationMs);
        const p = interpolate(a.from, a.to, k);
        a.marker.setLatLng([p.latitude, p.longitude]);
        if (k >= 1) a.durationMs = 0;
      }
      framerRef.current = requestAnimationFrame(step);
    };
    framerRef.current = requestAnimationFrame(step);
    return () => {
      if (framerRef.current !== null) cancelAnimationFrame(framerRef.current);
    };
  }, []);

  function locateMe() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setMe(p);
        const map = mapRef.current;
        if (!map) return;
        if (meMarker.current) meMarker.current.remove();
        meMarker.current = L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({
            className: "",
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;
                   border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25);"></div>`,
          }),
        }).addTo(map);
        map.setView([p.latitude, p.longitude], 16);
      },
      () => toastNoLocation(t)
    );
  }

  const sel = selected === null ? null : locations.get(selected);
  const selBus = sel ? fleet.find((b) => b.id === sel.busId) : undefined;

  return (
    <Card title={t("live.map.title")} subtitle={t("live.map.subtitle")}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            realtime ? "bg-accent-500/15 text-accent-400" : "bg-slate-600/20 text-slate-400"
          }`}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: realtime ? "#22c55e" : "#64748b" }}
          />
          {realtime ? t("live.realtime") : t("live.polling")}
        </span>
        <button
          onClick={locateMe}
          className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-brand-500/50"
        >
          {t("live.locating")}
        </button>
        {calibratedStops.length === 0 && (
          <span className="text-xs text-slate-500">{t("live.nocoords")}</span>
        )}
      </div>

      {tilesBroken && (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t("live.tilesfailed")}
        </p>
      )}

      <div
        ref={mountRef}
        className="h-[420px] w-full overflow-hidden rounded-xl border border-slate-700/50 md:h-[520px]"
        style={{ background: "#0b1120" }}
      />

      {locations.size === 0 && (
        <div className="mt-3 rounded-xl border border-slate-700/50 bg-ink-950/40 p-4">
          <p className="text-sm text-slate-300">{t("live.none")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("live.none.hint")}</p>
        </div>
      )}

      {sel && <BusCard loc={sel} plate={selBus?.plateNumber} driver={selBus?.driverName}
                        line={selBus?.line} stops={calibratedStops} me={me} />}
    </Card>
  );
}

function toastNoLocation(t: (k: "gps.denied") => string) {
  // Imported lazily to keep this file's import list about the map.
  void import("../lib/toast").then((m) => m.toast.error(t("gps.denied")));
}

function BusCard({
  loc,
  plate,
  driver,
  line,
  stops,
  me,
}: {
  loc: BusLocation;
  plate?: string;
  driver?: string;
  line?: string;
  stops: Stop[];
  me: LatLng | null;
}) {
  const { t, lang } = useLang();
  const age = ageSeconds(loc.updatedAt);
  const fresh = freshness(age);
  const here: LatLng = { latitude: loc.latitude, longitude: loc.longitude };

  const near = nearestStop(here, stops);
  const nextStopName = near
    ? lang === "zh"
      ? near.stop.chineseName
      : near.stop.englishName
    : null;

  // ETA is only meaningful once the stop actually has real coordinates.
  const eta = near ? etaMinutes(near.metres, loc.speedKmh) : null;
  const mineAway = me ? distanceMeters(me, here) : null;

  return (
    <div className="mt-3 rounded-xl border border-slate-700/50 bg-ink-950/50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-display text-lg font-bold text-white">{plate ?? `#${loc.busId}`}</p>
        {line && (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
            {line}
          </span>
        )}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{
            backgroundColor:
              fresh === "live" ? "rgba(34,197,94,.15)" : fresh === "stale" ? "rgba(245,158,11,.15)" : "rgba(248,113,113,.15)",
            color: fresh === "live" ? "#4ade80" : fresh === "stale" ? "#fbbf24" : "#f87171",
          }}
        >
          {fresh === "live"
            ? t("live.realtime")
            : fresh === "stale"
              ? t("live.stale")
              : t("live.lost")}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs sm:grid-cols-3">
        {driver && (
          <span className="text-slate-400">
            {t("fleet.driver")}: <span className="text-slate-200">{driver}</span>
          </span>
        )}
        <span className="text-slate-400">
          {t("gps.speed")}:{" "}
          <span className="tabular-nums text-slate-200">
            {loc.speedKmh === null ? "—" : `${Math.round(loc.speedKmh)} km/h`}
          </span>
        </span>
        <span className="text-slate-400">
          {t("live.lastseen")}:{" "}
          <span className="tabular-nums text-slate-200">
            {age < 60
              ? `${Math.round(age)}${t("live.secondsago")}`
              : `${Math.round(age / 60)} ${t("live.minutesago")}`}
          </span>
        </span>
        {nextStopName && (
          <span className="text-slate-400">
            {t("live.nextstop")}: <span className="text-slate-200">{nextStopName}</span>
          </span>
        )}
        {near && (
          <span className="text-slate-400">
            {formatDistance(near.metres)} {t("live.away")}
          </span>
        )}
        {eta !== null && Number.isFinite(eta) && fresh !== "lost" && (
          <span className="text-slate-400">
            ETA:{" "}
            <span className="tabular-nums text-brand-400">
              {Math.max(1, Math.round(eta))} {t("home.min")}
            </span>
          </span>
        )}
        {mineAway !== null && (
          <span className="text-slate-400">
            {formatDistance(mineAway)} {t("live.away")} ({t("live.locating")})
          </span>
        )}
      </div>
    </div>
  );
}
