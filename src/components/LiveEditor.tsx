import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import Card from "./Card";
import DataBackup from "./DataBackup";
import type { Stop, Route } from "../data/campusData";
import { findShortestRoute } from "../algorithms/dijkstra";
import {
  loadStops,
  loadRoutes,
  saveStops,
  saveRoutes,
  resetAll,
} from "../lib/persist";
import {
  isCloudConfigured,
  cloudFetch,
  cloudUpsertStop,
  cloudUpsertRoute,
  cloudSeed,
  cloudDeleteStop,
  cloudDeleteRoute,
  subscribeToChanges,
  signIn,
  signOut,
  currentEmail,
  onAuthChange,
  type RealtimeStatus,
} from "../lib/cloud";

// If the realtime WebSocket can't connect (blocked network, Realtime not
// turned on for these tables in the Supabase dashboard, etc.), fall back to
// polling the REST API on a timer so edits from other people still show up
// within this many milliseconds, just not instantly.
const POLL_INTERVAL_MS = 20_000;
import { toast } from "../lib/toast";
import { safeApply } from "../lib/safeApply";

// A self-contained interactive editor. It keeps its own data in the browser
// (localStorage) so changes are remembered after a reload. This is the first
// step toward a real database-backed version.
export default function LiveEditor() {
  const [stops, setStops] = useState<Stop[]>(() => loadStops());
  const [routes, setRoutes] = useState<Route[]>(() => loadRoutes());
  const [cloudOn, setCloudOn] = useState(false);
  const [cloudMsg, setCloudMsg] = useState("");
  // Separate from cloudOn: cloudOn means "we loaded data from the cloud at
  // least once". realtimeLive means "the live WebSocket is actually
  // connected right now". The two used to be conflated, which made the
  // editor claim "Cloud connected · live" even when the realtime channel had
  // failed and no one else's edits would show up until a manual refresh.
  const [realtimeLive, setRealtimeLive] = useState(false);

  // Admin login state.
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginMsg, setLoginMsg] = useState("");

  useEffect(() => {
    if (!isCloudConfigured()) return;
    currentEmail().then(setAdminEmail);
    const unsub = onAuthChange(setAdminEmail);
    return unsub;
  }, []);

  async function handleLogin() {
    setLoginMsg("Signing in...");
    const err = await signIn(loginEmail.trim(), loginPass);
    if (err) {
      setLoginMsg("Login failed: " + err);
      toast.error("Login failed: " + err);
    } else {
      setLoginMsg("");
      setLoginPass("");
      toast.success("Signed in as admin");
    }
  }

  const isAdmin = adminEmail !== null;

  // Push all current stops and routes to the cloud, showing the result.
  async function syncAllToCloud() {
    if (!isCloudConfigured()) {
      setCloudMsg("Cloud is not configured (check supabaseConfig.ts).");
      return;
    }
    setCloudMsg("Syncing to cloud...");
    const err = await cloudSeed(stops, routes);
    if (err) {
      setCloudMsg("Cloud error: " + err);
      toast.error("Cloud sync failed");
    } else {
      setCloudMsg(
        `Synced ${stops.length} stops and ${routes.length} routes to the cloud.`
      );
      setCloudOn(true);
      toast.success(`Synced ${stops.length} stops · ${routes.length} routes`);
    }
  }

  // Persist to the browser whenever the data changes.
  useEffect(() => saveStops(stops), [stops]);
  useEffect(() => saveRoutes(routes), [routes]);

  // On first load, if the cloud is configured, use it as the source of truth.
  // If the cloud is empty, upload the current data once to seed it.
  useEffect(() => {
    if (!isCloudConfigured()) return;
    let active = true;
    (async () => {
      try {
        const data = await cloudFetch();
        if (!active) return;
        if (data.stops.length === 0 && data.routes.length === 0) {
          await cloudSeed(loadStops(), loadRoutes());
          setCloudOn(true);
          return;
        }
        if (data.stops.length === 0 || data.routes.length === 0) {
          // One table came back empty and the other didn't - almost always
          // a Row Level Security policy problem on just that table, not a
          // real deletion. Keep whatever we already have instead of
          // blanking half the app, and say so plainly.
          toast.error(
            "Cloud returned no data for part of the campus map — keeping what's on screen. Check the Supabase Row Level Security policies."
          );
        }
        setStops((current) => safeApply(current, data.stops));
        setRoutes((current) => safeApply(current, data.routes));
        setCloudOn(true);
      } catch (e) {
        // If the cloud call fails, keep using local data.
        console.warn("Cloud not reachable, using local data.", e);
        toast.error("Cloud unreachable — showing local data");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Live updates: refetch from the cloud whenever anyone changes the data.
  // If the realtime WebSocket itself never connects, we still want other
  // people's edits to show up eventually, so we poll on a timer as a
  // fallback instead of silently staying stale forever.
  useEffect(() => {
    if (!isCloudConfigured()) return;

    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let warnedOnce = false;

    const refetch = async () => {
      try {
        const data = await cloudFetch();
        setStops((current) => safeApply(current, data.stops));
        setRoutes((current) => safeApply(current, data.routes));
      } catch (e) {
        console.warn("Poll refetch failed", e);
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(refetch, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const handleStatus = (status: RealtimeStatus) => {
      if (status === "SUBSCRIBED") {
        setRealtimeLive(true);
        stopPolling();
        return;
      }
      // CHANNEL_ERROR / TIMED_OUT / CLOSED: the live socket isn't working.
      // Keep the rest of the editor usable by polling instead, and tell the
      // user once (not on every retry) so it's clear why updates feel slow.
      setRealtimeLive(false);
      startPolling();
      if (!warnedOnce) {
        warnedOnce = true;
        toast.info(
          "Live sync couldn't connect — updates will refresh every 20s instead. Check the Supabase project's Realtime settings if this persists."
        );
      }
    };

    const unsubscribe = subscribeToChanges(refetch, handleStatus);
    return () => {
      unsubscribe();
      stopPolling();
    };
  }, []);

  // New stop form.
  const [stopName, setStopName] = useState("");
  const [stopCn, setStopCn] = useState("");
  const [stopX, setStopX] = useState(50);
  const [stopY, setStopY] = useState(50);

  // New route form.
  const [routeName, setRouteName] = useState("");
  const [routeFrom, setRouteFrom] = useState<number>(stops[0]?.id ?? 1);
  const [routeTo, setRouteTo] = useState<number>(stops[1]?.id ?? 2);
  const [routeTime, setRouteTime] = useState(5);

  // Shortest route query.
  const [src, setSrc] = useState<number>(stops[0]?.id ?? 1);
  const [dst, setDst] = useState<number>(stops[stops.length - 1]?.id ?? 1);

  const nextStopId = useMemo(
    () => (stops.length ? Math.max(...stops.map((s) => s.id)) + 1 : 1),
    [stops]
  );
  const nextRouteId = useMemo(
    () => (routes.length ? Math.max(...routes.map((r) => r.id)) + 1 : 1),
    [routes]
  );

  const result = useMemo(
    () => findShortestRoute(stops, routes, src, dst),
    [stops, routes, src, dst]
  );

  // A bus that animates along the current shortest path (loops until stopped).
  const [busPos, setBusPos] = useState<{ x: number; y: number } | null>(null);
  const [busRunning, setBusRunning] = useState(false);
  const busFrame = useRef<number | null>(null);

  function toggleBus() {
    // If it is already running, stop it.
    if (busRunning) {
      if (busFrame.current) cancelAnimationFrame(busFrame.current);
      busFrame.current = null;
      setBusRunning(false);
      setBusPos(null);
      return;
    }
    if (!result.found || result.path.length < 2) return;

    const points = result.path.map((id) => {
      const s = stops.find((x) => x.id === id);
      return { x: s ? s.x : 50, y: s ? s.y : 50 };
    });

    setBusRunning(true);
    const msPerSegment = 1100;
    const total = (points.length - 1) * msPerSegment;
    let startTime = performance.now();

    const step = (now: number) => {
      let t = (now - startTime) / total;
      if (t >= 1) {
        // loop back to the start
        startTime = now;
        t = 0;
      }
      const scaled = t * (points.length - 1);
      const seg = Math.min(points.length - 2, Math.floor(scaled));
      const localT = scaled - seg;
      const a = points[seg];
      const b = points[seg + 1];
      setBusPos({
        x: a.x + (b.x - a.x) * localT,
        y: a.y + (b.y - a.y) * localT,
      });
      busFrame.current = requestAnimationFrame(step);
    };
    busFrame.current = requestAnimationFrame(step);
  }

  // Stop the animation when the component is removed.
  useEffect(() => {
    return () => {
      if (busFrame.current) cancelAnimationFrame(busFrame.current);
    };
  }, []);

  // Every write below awaits the cloud call and checks its error before
  // claiming success. Firing the write and toasting "success" regardless
  // (the old behaviour) is the write-side version of the read-side bug
  // documented in CASE_STUDY.md: it told the admin their change was saved
  // when the cloud may have silently rejected it (a paused project, a
  // dropped connection, a policy gap), leaving the browser's local copy as
  // the only place the edit actually existed.
  async function addStop() {
    if (!stopName.trim()) return;
    const s: Stop = {
      id: nextStopId,
      englishName: stopName.trim(),
      chineseName: stopCn.trim(),
      x: Math.min(100, Math.max(0, stopX)),
      y: Math.min(100, Math.max(0, stopY)),
      passengerCount: 0,
    };
    setStops((prev) => [...prev, s]);
    setStopName("");
    setStopCn("");
    if (isCloudConfigured()) {
      const err = await cloudUpsertStop(s);
      if (err) {
        toast.error(`Stop kept locally, but the cloud save failed: ${err}`);
        return;
      }
    }
    toast.success(`Added stop "${s.englishName}"`);
  }

  async function addRoute() {
    if (routeFrom === routeTo) return;
    const r: Route = {
      id: nextRouteId,
      name: routeName.trim() || `Route ${nextRouteId}`,
      sourceStopId: routeFrom,
      destinationStopId: routeTo,
      travelTimeMinutes: Math.max(0, routeTime),
      delayMinutes: 0,
    };
    setRoutes((prev) => [...prev, r]);
    setRouteName("");
    if (isCloudConfigured()) {
      const err = await cloudUpsertRoute(r);
      if (err) {
        toast.error(`Route kept locally, but the cloud save failed: ${err}`);
        return;
      }
    }
    toast.success(`Added route "${r.name}"`);
  }

  function reset() {
    resetAll();
    setStops(loadStops());
    setRoutes(loadRoutes());
  }

  // Delete a stop and any routes that touch it.
  async function deleteStop(id: number) {
    const affected = routes
      .filter((r) => r.sourceStopId === id || r.destinationStopId === id)
      .map((r) => r.id);
    setStops((prev) => prev.filter((s) => s.id !== id));
    setRoutes((prev) =>
      prev.filter((r) => r.sourceStopId !== id && r.destinationStopId !== id)
    );
    if (isCloudConfigured()) {
      const [stopErr, ...routeErrs] = await Promise.all([
        cloudDeleteStop(id),
        ...affected.map((rid) => cloudDeleteRoute(rid)),
      ]);
      const firstError = stopErr ?? routeErrs.find((e) => e);
      if (firstError) {
        toast.error(`Deleted locally, but the cloud delete failed: ${firstError}`);
        return;
      }
    }
    toast.info("Stop deleted");
  }

  async function deleteRoute(id: number) {
    setRoutes((prev) => prev.filter((r) => r.id !== id));
    if (isCloudConfigured()) {
      const err = await cloudDeleteRoute(id);
      if (err) {
        toast.error(`Deleted locally, but the cloud delete failed: ${err}`);
        return;
      }
    }
    toast.info("Route deleted");
  }

  // Change the number of waiting passengers at a stop (never below zero).
  function changePassengers(id: number, delta: number) {
    setStops((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = {
          ...s,
          passengerCount: Math.max(0, s.passengerCount + delta),
        };
        if (isCloudConfigured()) {
          cloudUpsertStop(updated).then((err) => {
            if (err) {
              toast.error(`Passenger count kept locally, but the cloud save failed: ${err}`);
            }
          });
        }
        return updated;
      })
    );
  }

  const busiestStopId = useMemo(() => {
    let id = -1;
    let max = 0;
    for (const s of stops) {
      if (s.passengerCount > max) {
        max = s.passengerCount;
        id = s.id;
      }
    }
    return id;
  }, [stops]);

  // QR code: pick a stop and show a QR that opens this app focused on it.
  const [qrStopId, setQrStopId] = useState<number>(stops[0]?.id ?? 1);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const origin = window.location.origin;
    const url = `${origin}/?to=${qrStopId}`;
    QRCode.toDataURL(url, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [qrStopId]);

  // On first load, if the URL has ?to=<id>, set the destination to that stop.
  useEffect(() => {
    const to = new URLSearchParams(window.location.search).get("to");
    const id = to ? Number(to) : NaN;
    if (!Number.isNaN(id)) setDst(id);
  }, []);

  function stopName2(id: number): string {
    return stops.find((s) => s.id === id)?.englishName ?? "?";
  }

  const pathIds = result.path;

  const input =
    "w-full rounded-lg border border-slate-700 bg-ink-900 px-2 py-1.5 text-sm text-slate-100";
  const label = "mb-1 block text-xs text-slate-400";

  return (
    <div className="space-y-6">
      <Card
        title="Live Campus Editor"
        subtitle={
          !cloudOn
            ? "Saved locally"
            : realtimeLive
              ? "Cloud connected · live"
              : "Cloud connected · refreshing every 20s"
        }
      >

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Map */}
          <div className="lg:col-span-3">
            <div
              className="relative w-full overflow-hidden rounded-xl border border-slate-700/60 bg-ink-950"
              style={{ aspectRatio: "1080 / 701" }}
            >
              <img
                src="/ynu-campus-map.jpg"
                alt="Campus map"
                className="absolute inset-0 h-full w-full object-cover opacity-90"
              />
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
              >
                {routes.map((r) => {
                  const a = stops.find((s) => s.id === r.sourceStopId);
                  const b = stops.find((s) => s.id === r.destinationStopId);
                  if (!a || !b) return null;
                  const active = result.routeIds.includes(r.id);
                  return (
                    <line
                      key={r.id}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={active ? "#60a5fa" : "#e2e8f0"}
                      strokeWidth={active ? 1.1 : 0.5}
                      opacity={active ? 1 : 0.55}
                    />
                  );
                })}
              </svg>
              {stops.map((s) => {
                const onPath = pathIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                    style={{ left: `${s.x}%`, top: `${s.y}%` }}
                  >
                    <span
                      className={`mx-auto block rounded-full ring-2 ${
                        onPath
                          ? "h-3 w-3 bg-brand-500 ring-brand-400"
                          : "h-2.5 w-2.5 bg-slate-200 ring-slate-500"
                      }`}
                    />
                    <span
                      className={`mt-0.5 block whitespace-nowrap rounded px-1 text-[9px] ${
                        s.id === busiestStopId
                          ? "bg-red-500/90 font-semibold text-white"
                          : "bg-ink-950/80 text-slate-200"
                      }`}
                    >
                      {s.englishName}
                      {s.passengerCount > 0 ? ` · ${s.passengerCount}` : ""}
                    </span>
                  </div>
                );
              })}

              {/* Animated bus travelling along the shortest path */}
              {busPos && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${busPos.x}%`, top: `${busPos.y}%`, zIndex: 20 }}
                >
                  <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-amber-400/60" />
                  <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-ink-950 shadow-lg ring-2 ring-white">
                    BUS
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-slate-700/50 bg-ink-950/40 p-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className={label}>From</span>
                  <select
                    className={input}
                    value={src}
                    onChange={(e) => setSrc(Number(e.target.value))}
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.englishName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className={label}>To</span>
                  <select
                    className={input}
                    value={dst}
                    onChange={(e) => setDst(Number(e.target.value))}
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.englishName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-sm text-slate-200">
                {result.found
                  ? result.path.map((id) => stopName2(id)).join(" -> ")
                  : "No path found."}
              </p>
              {result.found && (
                <p className="text-sm text-brand-400">
                  Total time:{" "}
                  <span className="font-semibold">
                    {result.totalMinutes} min
                  </span>{" "}
                  (computed live by Dijkstra)
                </p>
              )}
              {result.found && result.path.length >= 2 && (
                <button
                  onClick={toggleBus}
                  className={`mt-3 w-full rounded-lg px-3 py-1.5 text-sm font-medium ${
                    busRunning
                      ? "border border-red-400/40 bg-red-500/15 text-red-300"
                      : "border border-amber-400/40 bg-amber-400/15 text-amber-300"
                  }`}
                >
                  {busRunning ? "Stop bus" : "Run bus along this route"}
                </button>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-700/50 bg-ink-950/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-200">
                    Stop QR code
                  </p>
                  <p className="mb-2 text-xs text-slate-400">
                    Scan with a phone to open the route to this stop.
                  </p>
                  <select
                    className={input}
                    value={qrStopId}
                    onChange={(e) => setQrStopId(Number(e.target.value))}
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.englishName}
                      </option>
                    ))}
                  </select>
                </div>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR code for the selected stop"
                    className="h-28 w-28 rounded bg-white p-1"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Forms / Admin */}
          <div className="space-y-4 lg:col-span-2">
            {!isAdmin ? (
              <div className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-3">
                <p className="mb-1 text-sm font-medium text-slate-200">
                  Admin login
                </p>
                <p className="mb-3 text-xs text-slate-400">
                  Only an admin can add stops and routes. Everyone can still view
                  the map and the shortest route.
                </p>
                <input
                  className={input}
                  placeholder="Email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
                <input
                  className={`${input} mt-2`}
                  type="password"
                  placeholder="Password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                />
                <button
                  onClick={handleLogin}
                  className="mt-3 w-full rounded-lg border border-brand-500/40 bg-brand-500/15 px-3 py-1.5 text-sm font-medium text-brand-400"
                >
                  Login as admin
                </button>
                {loginMsg && (
                  <p className="mt-2 text-xs text-red-300">{loginMsg}</p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                  <span className="text-emerald-300">Admin: {adminEmail}</span>
                  <button
                    onClick={() => {
                      signOut();
                      toast.info("Signed out");
                    }}
                    className="rounded-lg border border-slate-600 px-3 py-1 text-slate-300"
                  >
                    Logout
                  </button>
                </div>
            <div className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-3">
              <p className="mb-2 text-sm font-medium text-slate-200">
                Add a stop
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  <span className={label}>Name (English)</span>
                  <input
                    className={input}
                    value={stopName}
                    onChange={(e) => setStopName(e.target.value)}
                    placeholder="e.g. Sports Complex"
                  />
                </label>
                <label className="text-sm">
                  <span className={label}>Name (Chinese)</span>
                  <input
                    className={input}
                    value={stopCn}
                    onChange={(e) => setStopCn(e.target.value)}
                    placeholder="e.g. 体育馆"
                  />
                </label>
                <label className="text-sm">
                  <span className={label}>Map X (0-100)</span>
                  <input
                    type="number"
                    className={input}
                    value={stopX}
                    onChange={(e) => setStopX(Number(e.target.value))}
                  />
                </label>
                <label className="text-sm">
                  <span className={label}>Map Y (0-100)</span>
                  <input
                    type="number"
                    className={input}
                    value={stopY}
                    onChange={(e) => setStopY(Number(e.target.value))}
                  />
                </label>
              </div>
              <button
                onClick={addStop}
                className="mt-3 w-full rounded-lg border border-brand-500/40 bg-brand-500/15 px-3 py-1.5 text-sm font-medium text-brand-400"
              >
                Add stop
              </button>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-3">
              <p className="mb-2 text-sm font-medium text-slate-200">
                Add a route
              </p>
              <label className="mb-2 block text-sm">
                <span className={label}>Route name</span>
                <input
                  className={input}
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Gate to Library"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  <span className={label}>From</span>
                  <select
                    className={input}
                    value={routeFrom}
                    onChange={(e) => setRouteFrom(Number(e.target.value))}
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.englishName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className={label}>To</span>
                  <select
                    className={input}
                    value={routeTo}
                    onChange={(e) => setRouteTo(Number(e.target.value))}
                  >
                    {stops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.englishName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 text-sm">
                  <span className={label}>Travel time (minutes)</span>
                  <input
                    type="number"
                    className={input}
                    value={routeTime}
                    onChange={(e) => setRouteTime(Number(e.target.value))}
                  />
                </label>
              </div>
              <button
                onClick={addRoute}
                className="mt-3 w-full rounded-lg border border-brand-500/40 bg-brand-500/15 px-3 py-1.5 text-sm font-medium text-brand-400"
              >
                Add route
              </button>
            </div>

            <div className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-3 text-sm text-slate-400">
              <div className="flex items-center justify-between">
                <span>
                  {stops.length} stops, {routes.length} routes
                </span>
                <button
                  onClick={reset}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-slate-300"
                >
                  Reset to default
                </button>
              </div>
              <button
                onClick={syncAllToCloud}
                className="mt-3 w-full rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-300"
              >
                Sync all to cloud
              </button>
              {cloudMsg && (
                <p
                  className={`mt-2 text-xs ${
                    cloudMsg.startsWith("Cloud error")
                      ? "text-red-300"
                      : "text-emerald-300"
                  }`}
                >
                  {cloudMsg}
                </p>
              )}
            </div>

            <DataBackup
              stops={stops}
              routes={routes}
              onImport={(s, r) => {
                setStops(s);
                setRoutes(r);
              }}
            />

                <div className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-3">
                  <p className="mb-2 text-sm font-medium text-slate-200">
                    Manage stops
                  </p>
                  <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
                    {stops.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-xs text-slate-300"
                      >
                        <span>
                          {s.englishName}{" "}
                          <span className="text-slate-500">
                            ({s.passengerCount})
                          </span>
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => changePassengers(s.id, 1)}
                            className="rounded border border-slate-600 px-2 py-0.5 text-slate-300"
                            title="Add a waiting passenger"
                          >
                            +
                          </button>
                          <button
                            onClick={() => changePassengers(s.id, -1)}
                            className="rounded border border-slate-600 px-2 py-0.5 text-slate-300"
                            title="Remove a waiting passenger"
                          >
                            &minus;
                          </button>
                          <button
                            onClick={() => deleteStop(s.id)}
                            className="rounded border border-red-400/40 px-2 py-0.5 text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mb-2 mt-3 text-sm font-medium text-slate-200">
                    Manage routes
                  </p>
                  <div className="max-h-28 space-y-1 overflow-y-auto pr-1">
                    {routes.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-xs text-slate-300"
                      >
                        <span>
                          {stopName2(r.sourceStopId)} &rarr;{" "}
                          {stopName2(r.destinationStopId)}
                        </span>
                        <button
                          onClick={() => deleteRoute(r.id)}
                          className="rounded border border-red-400/40 px-2 py-0.5 text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
