import { useEffect, useState } from "react";
import Card from "./Card";
import { busLines, type Bus } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { toast } from "../lib/toast";
import {
  cloudClearAlert,
  cloudDeleteBus,
  cloudFetchAlerts,
  cloudUpsertBus,
  currentEmail,
  isCloudConfigured,
  onAuthChange,
  type DriverAlert,
} from "../lib/cloud";
import { busLoad, fleetSummary, nextBusId, useFleet } from "../lib/fleet";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500";

const loadColor = { low: "#22c55e", medium: "#f59e0b", high: "#f87171" } as const;

// Admin fleet management: the list of real buses, who drives them, how full
// they are, and - for a signed-in admin - add / retire / edit.
//
// It gates itself on the same Supabase session as the Live Editor rather than
// taking an `isAdmin` prop, so it stays correct wherever it is rendered and
// cannot be shown in an editable state by a caller that forgot to pass the
// flag. The database enforces the same rule independently: only the
// `authenticated` role holds write privileges on the buses table.
export default function FleetPanel() {
  const { t, lang } = useLang();
  const { fleet, setFleet, refresh } = useFleet();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [line, setLine] = useState(busLines[0]?.code ?? "Z52");
  const [seats, setSeats] = useState(40);

  const [alerts, setAlerts] = useState<DriverAlert[]>([]);

  useEffect(() => {
    currentEmail().then(setAdminEmail);
    const unsub = onAuthChange(setAdminEmail);
    return unsub;
  }, []);

  const isAdmin = adminEmail !== null;

  // Emergency alerts are readable only by a signed-in admin - the database
  // refuses the query for anyone else - so only fetch them once signed in,
  // and poll while the panel is open so a new one turns up without a refresh.
  useEffect(() => {
    if (!isAdmin || !isCloudConfigured()) {
      setAlerts([]);
      return;
    }
    let live = true;
    const load = async () => {
      try {
        const rows = await cloudFetchAlerts();
        if (live) setAlerts(rows);
      } catch {
        /* not signed in yet, or offline: leave the list as it is */
      }
    };
    void load();
    const id = window.setInterval(load, 15000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [isAdmin]);

  async function clearAlert(id: number) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    const err = await cloudClearAlert(id);
    if (err) toast.error(`Could not clear the alert: ${err}`);
  }
  const summary = fleetSummary(fleet);

  async function addBus() {
    if (!plate.trim()) return;
    const bus: Bus = {
      id: nextBusId(fleet),
      plateNumber: plate.trim(),
      driverName: driver.trim() || undefined,
      line,
      capacity: Math.max(1, seats),
      onboardCount: 0,
      active: true,
    };
    setFleet((prev) => [...prev, bus]);
    setPlate("");
    setDriver("");
    if (isCloudConfigured()) {
      const err = await cloudUpsertBus(bus);
      if (err) {
        toast.error(`Bus kept locally, but the cloud save failed: ${err}`);
        return;
      }
    }
    toast.success(`Added ${bus.plateNumber}`);
  }

  async function removeBus(id: number) {
    const gone = fleet.find((b) => b.id === id);
    setFleet((prev) => prev.filter((b) => b.id !== id));
    if (isCloudConfigured()) {
      const err = await cloudDeleteBus(id);
      if (err) {
        toast.error(`Removed locally, but the cloud delete failed: ${err}`);
        // Put it back: the row still exists in the database, so leaving it off
        // the screen would be a lie that a refresh silently undoes.
        void refresh();
        return;
      }
    }
    toast.info(`Removed ${gone?.plateNumber ?? "bus"}`);
  }

  async function toggleActive(id: number) {
    let updated: Bus | undefined;
    setFleet((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        updated = { ...b, active: !b.active };
        return updated;
      })
    );
    if (updated && isCloudConfigured()) {
      const err = await cloudUpsertBus(updated);
      if (err) toast.error(`Status kept locally, but the cloud save failed: ${err}`);
    }
  }

  return (
    <Card title={t("fleet.title")} subtitle={t("fleet.subtitle")}>
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("fleet.total"), value: summary.total },
          { label: t("fleet.active"), value: summary.active },
          { label: t("fleet.offroad"), value: summary.offRoad },
          { label: t("fleet.occupancy"), value: `${summary.load.pct}%` },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-3"
          >
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              {s.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Emergency alerts raised from the driver console. Admin-only: the
          database will not return these rows to anyone else. */}
      {isAdmin && (
        <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-300">
            {t("alerts.title")}
          </p>
          {alerts.length === 0 ? (
            <p className="mt-2 text-xs text-slate-400">{t("alerts.none")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-rose-500/25 bg-ink-950/40 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-rose-200">
                    {a.plateNumber}
                  </span>
                  {a.line && <span className="text-slate-400">{a.line}</span>}
                  {a.driverName && (
                    <span className="text-slate-300">{a.driverName}</span>
                  )}
                  {a.nearStop && (
                    <span className="text-slate-400">· {a.nearStop}</span>
                  )}
                  {a.raisedAt && (
                    <span className="text-slate-500">
                      {new Date(a.raisedAt).toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={() => a.id !== undefined && clearAlert(a.id)}
                    className="ml-auto rounded-lg border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    {t("alerts.clear")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* The fleet itself */}
      <div className="mt-5 space-y-2">
        {fleet.length === 0 && (
          <p className="text-sm text-slate-400">{t("fleet.empty")}</p>
        )}
        {fleet.map((b) => {
          const load = busLoad(b);
          return (
            <div
              key={b.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-700/50 bg-ink-950/40 px-4 py-3"
            >
              <div className="min-w-[8rem]">
                <p className="text-sm font-semibold text-white">
                  {b.plateNumber}
                </p>
                <p className="text-xs text-slate-500">
                  {b.driverName ?? t("fleet.nodriver")}
                </p>
              </div>

              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                {b.line}
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  b.active
                    ? "bg-accent-500/15 text-accent-400"
                    : "bg-slate-600/20 text-slate-400"
                }`}
              >
                {b.active ? t("fleet.instatus") : t("fleet.outstatus")}
              </span>

              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700/60">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${load.pct}%`,
                      backgroundColor: loadColor[load.level],
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums text-slate-400">
                  {b.onboardCount}/{b.capacity}
                </span>
              </div>

              {isAdmin && (
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={() => toggleActive(b.id)}
                    className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:border-brand-500/50"
                  >
                    {b.active ? t("fleet.outstatus") : t("fleet.instatus")}
                  </button>
                  <button
                    onClick={() => removeBus(b.id)}
                    className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                  >
                    {t("fleet.remove")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add a bus - admin only */}
      {isAdmin ? (
        <div className="mt-5 rounded-xl border border-slate-700/50 bg-ink-950/40 p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">
            {t("fleet.add")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className={input}
              placeholder={t("fleet.plate")}
              aria-label={t("fleet.plate")}
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />
            <input
              className={input}
              placeholder={t("fleet.driver")}
              aria-label={t("fleet.driver")}
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            />
            <select
              className={input}
              aria-label={t("fleet.line")}
              value={line}
              onChange={(e) => setLine(e.target.value)}
            >
              {busLines.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.code} · {lang === "zh" ? l.code : l.displayName}
                </option>
              ))}
            </select>
            <input
              className={input}
              type="number"
              min={1}
              placeholder={t("fleet.capacity")}
              aria-label={t("fleet.capacity")}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
          </div>
          <button
            onClick={addBus}
            disabled={!plate.trim()}
            className="mt-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("fleet.add")}
          </button>
        </div>
      ) : (
        <p className="mt-5 text-xs text-slate-500">{t("fleet.readonly")}</p>
      )}
    </Card>
  );
}
