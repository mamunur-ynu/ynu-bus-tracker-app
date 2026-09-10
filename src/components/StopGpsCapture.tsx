import { useEffect, useState } from "react";
import Card from "./Card";
import { stops as seedStops, type Stop } from "../data/campusData";
import { useLang } from "../lib/i18n";
import { toast } from "../lib/toast";
import {
  cloudFetch,
  cloudUpsertStop,
  currentEmail,
  isCloudConfigured,
  onAuthChange,
} from "../lib/cloud";
import { accuracyLevel } from "../lib/geo";

/**
 * Records the real-world position of each stop by reading the phone's GPS
 * while standing at it.
 *
 * This exists because the app had no honest way to place a stop on a real map.
 * The x/y already stored are percentages on an illustrated picture of campus;
 * converting those into latitude and longitude would have produced confident
 * coordinates that were simply made up. Walking the route once and pressing
 * Capture is slower, but the numbers are then actually true - and the live
 * tracking map's distances and ETAs are only as honest as these are.
 */
export default function StopGpsCapture() {
  const { t, lang } = useLang();
  const [stops, setStops] = useState<Stop[]>(seedStops);
  const [email, setEmail] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    currentEmail().then(setEmail);
    return onAuthChange(setEmail);
  }, []);

  useEffect(() => {
    if (!isCloudConfigured()) return;
    let live = true;
    cloudFetch()
      .then(({ stops: rows }) => {
        if (live && rows.length > 0) setStops(rows);
      })
      .catch(() => {
        /* keep the bundled list; the editor surfaces cloud errors already */
      });
    return () => {
      live = false;
    };
  }, []);

  const isAdmin = email !== null;
  const done = stops.filter((s) => s.latitude != null && s.longitude != null).length;

  function capture(stop: Stop) {
    if (!("geolocation" in navigator)) {
      toast.error(t("gps.unavailable"));
      return;
    }
    setBusyId(stop.id);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const updated: Stop = { ...stop, latitude, longitude };
        setStops((prev) => prev.map((s) => (s.id === stop.id ? updated : s)));
        setBusyId(null);

        if (!isCloudConfigured()) return;
        const err = await cloudUpsertStop(updated);
        if (err) {
          toast.error(`Not saved: ${err}`);
          return;
        }
        const acc = accuracyLevel(accuracy);
        toast.success(
          `${t("cal.saved")} — ${stop.englishName} (±${Math.round(accuracy)} m, ${t(
            acc === "high"
              ? "gps.acc.high"
              : acc === "medium"
                ? "gps.acc.medium"
                : acc === "low"
                  ? "gps.acc.low"
                  : "gps.acc.unknown"
          )})`
        );
      },
      () => {
        setBusyId(null);
        toast.error(t("gps.denied"));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <Card title={t("cal.title")} subtitle={`${done}/${stops.length} ${t("cal.progress")}`}>
      <p className="text-xs text-slate-400">{t("cal.hint")}</p>

      {!isAdmin && (
        <p className="mt-3 text-xs text-amber-300">{t("cal.adminonly")}</p>
      )}

      <ul className="mt-4 space-y-2">
        {stops.map((s) => {
          const has = s.latitude != null && s.longitude != null;
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-800/70 px-3 py-2.5 text-sm"
            >
              <span className="text-slate-200">
                {lang === "zh" ? s.chineseName : s.englishName}
              </span>
              {has ? (
                <span className="tabular-nums text-xs text-accent-400">
                  {s.latitude!.toFixed(5)}, {s.longitude!.toFixed(5)}
                </span>
              ) : (
                <span className="text-xs text-slate-500">{t("cal.missing")}</span>
              )}
              {isAdmin && (
                <button
                  onClick={() => capture(s)}
                  disabled={busyId === s.id}
                  className="ml-auto rounded-lg border border-brand-500/40 px-3 py-1 text-xs font-semibold text-brand-400 disabled:opacity-40"
                >
                  {busyId === s.id ? t("gps.requesting") : t("cal.capture")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
