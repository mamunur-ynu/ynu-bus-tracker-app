import { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";
import { busLines, getStop, type Bus } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { toast } from "../lib/toast";
import { cloudRaiseAlert, cloudUpsertBus, isCloudConfigured } from "../lib/cloud";
import { useFleet } from "../lib/fleet";
import { tripDuration, tripProgress } from "../lib/trip";
import { SIM_MIN_PER_SEC } from "../lib/arrivals";
import DriverGpsPanel from "./DriverGpsPanel";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-2 text-sm text-white";

// The driver's own screen: which bus they are on, where they are along the
// line, how many people are aboard, and one button to call for help.
//
// There is deliberately no driver login. This app has exactly one real account
// (the campus admin), and inventing a driver sign-in that authenticates against
// nothing would be a prop, not a feature. A driver instead picks their bus off
// the real fleet, the way they would pick up a shift. The one thing that must
// work regardless - the emergency alert - is wired to a real table that accepts
// an anonymous insert, so it reaches the admin without a login.
export default function DriverConsole() {
  const { t, lang } = useLang();
  const { fleet, setFleet } = useFleet();

  const [busId, setBusId] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, force] = useState(0);
  const tickRef = useRef<number | null>(null);

  // Default to the first bus once the fleet has loaded.
  useEffect(() => {
    if (busId === null && fleet.length > 0) setBusId(fleet[0].id);
  }, [fleet, busId]);

  // Only run a clock while a trip is actually in progress.
  useEffect(() => {
    if (startedAt === null) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    tickRef.current = window.setInterval(
      () => force((n) => n + 1),
      reduce ? 1000 : 500
    );
    return () => {
      if (tickRef.current !== null) window.clearInterval(tickRef.current);
    };
  }, [startedAt]);

  const bus: Bus | undefined = fleet.find((b) => b.id === busId);
  const line = busLines.find((l) => l.code === bus?.line);
  const stopIds = useMemo(() => line?.stopIds ?? [], [line]);

  const elapsedSec = startedAt === null ? 0 : (Date.now() - startedAt) / 1000;
  const elapsedMin = elapsedSec * SIM_MIN_PER_SEC;
  const progress = tripProgress(stopIds, elapsedMin);
  const totalMin = tripDuration(stopIds);

  const stopLabel = (id: number | undefined) => {
    if (id === undefined) return "—";
    const s = getStop(id);
    if (!s) return `#${id}`;
    return lang === "zh" ? s.chineseName : s.englishName;
  };

  async function changeOnboard(delta: number) {
    if (!bus) return;
    const updated: Bus = {
      ...bus,
      onboardCount: Math.max(0, Math.min(bus.capacity, bus.onboardCount + delta)),
    };
    setFleet((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    if (isCloudConfigured()) {
      const err = await cloudUpsertBus(updated);
      // A driver is not signed in, so the database will refuse this write.
      // That is the design, not a failure - say so plainly instead of
      // pretending the count was saved.
      if (err) toast.info(t("driver.localonly"));
    }
  }

  async function raiseEmergency() {
    if (!bus) return;
    const nearStop = stopLabel(stopIds[progress.currentIndex]);
    // This is the one button that must never quietly do nothing. If it cannot
    // reach the admin, the driver has to hear that clearly and be told what to
    // do instead - a raw "TypeError: Failed to fetch" is useless to someone
    // who needs help right now.
    if (!isCloudConfigured()) {
      toast.error(t("driver.emergency.failed"));
      return;
    }
    let err: string | null;
    try {
      err = await cloudRaiseAlert({
        busId: bus.id,
        plateNumber: bus.plateNumber,
        driverName: bus.driverName,
        line: bus.line,
        nearStop,
        note: startedAt === null ? "Raised before trip start" : "Raised during trip",
      });
    } catch {
      // A dropped network throws rather than returning an error string.
      err = "network";
    }
    if (err) {
      toast.error(t("driver.emergency.failed"));
      return;
    }
    toast.success(t("driver.emergency.sent"));
  }

  const onShift = startedAt !== null && !progress.finished;

  return (
    <Card title={t("driver.title")} subtitle={t("driver.subtitle")}>
      {fleet.length === 0 ? (
        <p className="text-sm text-slate-400">{t("driver.nobus")}</p>
      ) : (
        <>
          {/* Shift setup */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">
                {t("driver.pick")}
              </span>
              <select
                className={input}
                value={busId ?? ""}
                onChange={(e) => {
                  setBusId(Number(e.target.value));
                  setStartedAt(null);
                }}
                disabled={startedAt !== null}
              >
                {fleet.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.plateNumber} · {b.line}
                    {b.driverName ? ` · ${b.driverName}` : ""}
                  </option>
                ))}
              </select>
            </label>

            {startedAt === null ? (
              <button
                onClick={() => setStartedAt(Date.now())}
                disabled={!bus}
                className="rounded-full bg-gradient-to-r from-accent-600 to-accent-500 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {t("driver.start")}
              </button>
            ) : (
              <button
                onClick={() => setStartedAt(null)}
                className="rounded-full border border-slate-600 px-6 py-2.5 text-sm font-semibold text-slate-200"
              >
                {t("driver.end")}
              </button>
            )}
          </div>

          {/* Status strip */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                onShift
                  ? "bg-accent-500/15 text-accent-400"
                  : "bg-slate-600/20 text-slate-400"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: onShift ? "#22c55e" : "#64748b" }}
              />
              {progress.finished && startedAt !== null
                ? t("driver.arrived")
                : onShift
                  ? t("driver.onshift")
                  : t("driver.offshift")}
            </span>
            {startedAt !== null && (
              <span className="text-xs tabular-nums text-slate-400">
                {t("driver.elapsed")} {Math.floor(elapsedSec / 60)}:
                {String(Math.floor(elapsedSec % 60)).padStart(2, "0")}
              </span>
            )}
          </div>

          {/* Real GPS broadcast - the part that puts this bus on the live map */}
          <DriverGpsPanel onTrip={startedAt !== null && !progress.finished} />

          {/* Trip progress */}
          {bus && stopIds.length > 0 && (
            <div className="mt-5 rounded-xl border border-slate-700/50 bg-ink-950/40 p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">
                    {t("driver.nextstop")}
                  </p>
                  <p className="font-display text-lg font-bold text-white">
                    {progress.finished
                      ? t("driver.arrived")
                      : stopLabel(stopIds[progress.nextIndex])}
                  </p>
                </div>
                {!progress.finished && startedAt !== null && (
                  <p
                    className="font-display text-2xl font-bold tabular-nums"
                    style={{ color: line?.color ?? "#2563eb" }}
                  >
                    {Math.max(1, Math.ceil(progress.minutesToNext))}
                    <span className="ml-1 text-sm">{t("home.min")}</span>
                  </p>
                )}
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{t("driver.progress")}</span>
                  <span className="tabular-nums">
                    {progress.currentIndex + 1}/{stopIds.length} ·{" "}
                    {Math.round(totalMin)} {t("home.min")}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-700/60">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.round(progress.fraction * 100)}%`,
                      backgroundColor: line?.color ?? "#2563eb",
                    }}
                  />
                </div>
              </div>

              {/* Stop sequence */}
              <ol className="mt-4 space-y-1.5">
                {stopIds.map((id, i) => {
                  const done = startedAt !== null && i <= progress.currentIndex;
                  const isNext = startedAt !== null && i === progress.nextIndex && !progress.finished;
                  return (
                    <li
                      key={id}
                      className={`flex items-center gap-2 text-xs ${
                        isNext
                          ? "font-semibold text-white"
                          : done
                            ? "text-slate-500 line-through"
                            : "text-slate-400"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: done
                            ? "#22c55e"
                            : isNext
                              ? (line?.color ?? "#2563eb")
                              : "#475569",
                        }}
                      />
                      {stopLabel(id)}
                    </li>
                  );
                })}
              </ol>

              <p className="mt-4 text-[11px] text-slate-500">{t("driver.simnote")}</p>
            </div>
          )}

          {/* Boarding count */}
          {bus && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/50 bg-ink-950/40 p-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">
                {t("driver.boarding")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeOnboard(-1)}
                  aria-label="One passenger off"
                  className="h-8 w-8 rounded-full border border-slate-600 text-slate-200"
                >
                  −
                </button>
                <span className="min-w-[4.5rem] text-center font-display text-xl font-bold tabular-nums text-white">
                  {bus.onboardCount}/{bus.capacity}
                </span>
                <button
                  onClick={() => changeOnboard(1)}
                  aria-label="One passenger on"
                  className="h-8 w-8 rounded-full border border-slate-600 text-slate-200"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Emergency */}
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-4">
            <button
              onClick={raiseEmergency}
              disabled={!bus}
              className="w-full rounded-full bg-rose-600 px-5 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-40"
            >
              {t("driver.emergency")}
            </button>
            <p className="mt-2 text-center text-[11px] text-rose-200/70">
              {t("driver.emergency.hint")}
            </p>
          </div>
        </>
      )}
    </Card>
  );
}
