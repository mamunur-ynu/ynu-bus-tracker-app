import { useEffect, useState } from "react";
import { useLang } from "../lib/i18n";
import { toast } from "../lib/toast";
import {
  cloudMyDriverBus,
  currentEmail,
  isCloudConfigured,
  onAuthChange,
  signIn,
} from "../lib/cloud";
import { useGpsBroadcast } from "../lib/gpsBroadcast";
import { accuracyLevel } from "../lib/geo";
import { useFleet } from "../lib/fleet";

const input =
  "w-full rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500";

const accKey = {
  high: "gps.acc.high",
  medium: "gps.acc.medium",
  low: "gps.acc.low",
  unknown: "gps.acc.unknown",
} as const;

const accColor = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#f87171",
  unknown: "#64748b",
} as const;

/**
 * The half of the driver console that puts a real bus on a real map.
 *
 * A driver must sign in, because the database will only accept a position for
 * the bus their account is assigned to - that rule is what stops anyone with
 * the public key from dragging a bus across campus. The sign-in here is the
 * university's own Supabase account; this component never stores a password.
 */
export default function DriverGpsPanel({ onTrip }: { onTrip: boolean }) {
  const { t } = useLang();
  const { fleet } = useFleet();
  const [email, setEmail] = useState<string | null>(null);
  const [assignedBus, setAssignedBus] = useState<number | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentEmail().then(setEmail);
    return onAuthChange(setEmail);
  }, []);

  // Which bus this account may move. Re-checked whenever the session changes.
  useEffect(() => {
    if (!email || !isCloudConfigured()) {
      setAssignedBus(null);
      return;
    }
    let live = true;
    cloudMyDriverBus().then((id) => {
      if (live) setAssignedBus(id);
    });
    return () => {
      live = false;
    };
  }, [email]);

  const canBroadcast = email !== null && assignedBus !== null;
  const { status } = useGpsBroadcast(assignedBus, canBroadcast && onTrip);

  async function doSignIn() {
    if (!loginEmail.trim() || !loginPass) return;
    setBusy(true);
    const err = await signIn(loginEmail.trim(), loginPass);
    setBusy(false);
    setLoginPass("");
    if (err) toast.error(`Sign in failed: ${err}`);
    else toast.success("Signed in");
  }

  const bus = fleet.find((b) => b.id === assignedBus);
  const acc = accuracyLevel(status.accuracyM);

  return (
    <div className="mt-4 rounded-xl border border-slate-700/50 bg-ink-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
          {t("gps.title")}
        </p>
        {canBroadcast && bus && (
          <span className="text-xs text-slate-400">
            {t("gps.assigned")}: <span className="text-slate-200">{bus.plateNumber}</span>
          </span>
        )}
      </div>

      {/* Not signed in: offer the driver login */}
      {!email && (
        <div className="mt-3">
          <p className="mb-3 text-xs text-slate-400">{t("gps.signin.hint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className={input}
              placeholder={t("driver.email")}
              aria-label={t("driver.email")}
              autoComplete="username"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />
            <input
              className={input}
              type="password"
              placeholder={t("driver.password")}
              aria-label={t("driver.passwordph")}
              autoComplete="current-password"
              value={loginPass}
              onChange={(e) => setLoginPass(e.target.value)}
            />
          </div>
          <button
            onClick={doSignIn}
            disabled={busy || !loginEmail.trim() || !loginPass}
            className="mt-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("gps.signin")}
          </button>
        </div>
      )}

      {/* Signed in but not a driver */}
      {email && assignedBus === null && (
        <p className="mt-3 text-xs text-amber-300">{t("gps.notdriver")}</p>
      )}

      {/* Signed in and assigned: show what the GPS is actually doing */}
      {canBroadcast && (
        <div className="mt-3 space-y-2">
          {!onTrip && (
            <p className="text-xs text-slate-400">
              {t("driver.offshift")} — {t("driver.start")}
            </p>
          )}

          {onTrip && status.state === "requesting" && (
            <p className="text-xs text-slate-300">{t("gps.requesting")}</p>
          )}
          {onTrip && status.state === "denied" && (
            <p className="text-xs text-rose-300">{t("gps.denied")}</p>
          )}
          {onTrip && status.state === "unavailable" && (
            <p className="text-xs text-amber-300">{t("gps.unavailable")}</p>
          )}
          {onTrip && status.state === "error" && (
            <p className="text-xs text-rose-300">{t("gps.error")}</p>
          )}

          {onTrip && status.state === "broadcasting" && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 rounded-full bg-accent-500/15 px-3 py-1 text-xs font-semibold text-accent-400">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#22c55e" }}
                  />
                  {t("gps.broadcasting")}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: accColor[acc] }}
                  />
                  {t(accKey[acc])}
                  {status.accuracyM !== null && (
                    <span className="tabular-nums">
                      ±{Math.round(status.accuracyM)} m
                    </span>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-3">
                <span className="tabular-nums">
                  {status.latitude?.toFixed(5)}, {status.longitude?.toFixed(5)}
                </span>
                <span>
                  {t("gps.speed")}:{" "}
                  <span className="tabular-nums text-slate-200">
                    {status.speedKmh === null ? "—" : `${Math.round(status.speedKmh)} km/h`}
                  </span>
                </span>
                <span>
                  {t("gps.lastsent")}:{" "}
                  <span className="tabular-nums text-slate-200">
                    {status.lastSentAt
                      ? `${Math.max(0, Math.round((Date.now() - status.lastSentAt) / 1000))}${t("live.secondsago")}`
                      : "—"}
                  </span>
                </span>
              </div>

              {status.sendError && (
                <p className="text-xs text-rose-300">
                  {t("gps.sendfailed")} {status.sendError}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
