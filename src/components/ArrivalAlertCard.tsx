import { useEffect, useMemo, useRef, useState } from "react";
import { getStop, stops } from "../data/campusData";
import { useLang } from "../lib/i18n";
import {
  buildLineModels,
  nextBusForStop,
  simElapsedSec,
} from "../lib/arrivals";
import {
  DEFAULT_LEAD_MINUTES,
  alertText,
  fireNotification,
  permissionState,
  requestPermission,
  shouldNotify,
} from "../lib/notify";

/**
 * Watch one stop and say something shortly before the bus gets there.
 *
 * The rules about when to actually speak live in lib/notify and are tested
 * there; this component only supplies the current state and does what it is
 * told. Two things worth knowing about the design:
 *
 * Permission is requested from the click on "Turn on alerts", never on page
 * load. Browsers ignore - and some now permanently block - a site that asks
 * for notification permission before the visitor has shown any interest.
 *
 * The caveat under the switch is not boilerplate. This fires from the page,
 * so it stops working the moment the tab is closed, and a student who missed
 * a bus trusting otherwise would be entitled to be cross about it.
 */
export default function ArrivalAlertCard() {
  const { t, lang } = useLang();
  const models = useMemo(() => buildLineModels(), []);
  const servedStops = useMemo(() => {
    const ids = new Set(models.flatMap((m) => m.stopIds));
    return stops.filter((s) => ids.has(s.id));
  }, [models]);

  const [stopId, setStopId] = useState<number>(servedStops[0]?.id ?? 0);
  const [lead, setLead] = useState(DEFAULT_LEAD_MINUTES);
  const [on, setOn] = useState(false);
  const [permission, setPermission] = useState(permissionState());
  const [, tick] = useState(0);
  const lastFiredAt = useRef<number | null>(null);

  // Re-check the countdown on a slow tick. Slow on purpose: this is not the
  // screen showing the number, it only needs to catch the moment it crosses
  // the lead time, and the cooldown means being a second late costs nothing.
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => tick((n) => n + 1), 2000);
    return () => window.clearInterval(id);
  }, [on]);

  const next = stopId ? nextBusForStop(models, stopId, simElapsedSec()) : null;

  useEffect(() => {
    if (!on || !next) return;
    const fire = shouldNotify({
      eta: next.eta,
      leadMinutes: lead,
      pageHidden: typeof document !== "undefined" && document.hidden,
      permission,
      lastFiredAt: lastFiredAt.current,
      now: Date.now(),
    });
    if (!fire) return;
    const stop = getStop(stopId);
    const name = (lang === "zh" ? stop?.chineseName : stop?.englishName) ?? "";
    const { title, body } = alertText(name, next.line.code, next.eta, lang);
    if (fireNotification(title, body)) lastFiredAt.current = Date.now();
  });

  const toggle = async () => {
    if (on) {
      setOn(false);
      return;
    }
    const p = permission === "granted" ? permission : await requestPermission();
    setPermission(p);
    if (p === "granted") {
      lastFiredAt.current = null;
      setOn(true);
    }
  };

  const field =
    "rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-1.5 text-sm text-slate-200";

  return (
    <div className="card p-5">
      <h3 className="card-title">{t("alert.title")}</h3>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="alert-stop">
          {t("alert.stop")}
        </label>
        <select
          id="alert-stop"
          value={stopId}
          onChange={(e) => {
            setStopId(Number(e.target.value));
            // A new stop means a fresh alert is fair, even inside the cooldown.
            lastFiredAt.current = null;
          }}
          className={field}
        >
          {servedStops.map((s) => (
            <option key={s.id} value={s.id}>
              {lang === "zh" ? s.chineseName : s.englishName}
            </option>
          ))}
        </select>

        <span className="text-xs text-slate-400">{t("alert.lead")}</span>
        <select
          value={lead}
          onChange={(e) => setLead(Number(e.target.value))}
          aria-label={t("alert.lead")}
          className={field}
        >
          {[2, 3, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{t("alert.leadunit")}</span>
      </div>

      <button
        onClick={toggle}
        disabled={permission === "unsupported" || permission === "denied"}
        className={`mt-4 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 ${
          on
            ? "border border-accent-500/50 text-accent-400"
            : "bg-gradient-to-r from-brand-500 to-brand-600 text-white"
        }`}
      >
        {on ? t("alert.off") : t("alert.on")}
      </button>

      {on && next && (
        <p className="mt-3 text-sm text-slate-300" role="status">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent-500 align-middle" />
          {t("alert.watching")} · {next.line.code} ·{" "}
          <span className="tabular-nums">{Math.max(1, Math.ceil(next.eta))}</span>{" "}
          {t("home.min")}
        </p>
      )}

      {permission === "denied" && (
        <p className="mt-3 text-xs text-amber-300/90">{t("alert.denied")}</p>
      )}
      {permission === "unsupported" && (
        <p className="mt-3 text-xs text-amber-300/90">{t("alert.unsupported")}</p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {t("alert.caveat")}
      </p>
    </div>
  );
}
