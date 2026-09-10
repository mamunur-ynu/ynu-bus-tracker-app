import { useEffect, useState } from "react";
import { useLang } from "../lib/i18n";
import { busLines, lineNameIn} from "../data/campusData";
import { cloudFetchRatings, cloudRateRide, isCloudConfigured } from "../lib/cloud";
import type { RideRating } from "../lib/cloud";
import {
  formatAverage,
  markRated,
  recentlyRated,
  starParts,
  summarise,
} from "../lib/ratings";

function Star({ fill }: { fill: "full" | "half" | "none" }) {
  const id = `half-${Math.random().toString(36).slice(2, 8)}`;
  const d =
    "M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {fill === "half" && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#334155" />
          </linearGradient>
        </defs>
      )}
      <path
        d={d}
        fill={
          fill === "full" ? "#fbbf24" : fill === "half" ? `url(#${id})` : "#334155"
        }
      />
    </svg>
  );
}

function Stars({ average }: { average: number | null }) {
  const { full, half } = starParts(average);
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          fill={i < full ? "full" : i === full && half ? "half" : "none"}
        />
      ))}
    </span>
  );
}

/**
 * Let a rider score the line they just used, and show what everyone else
 * thinks.
 *
 * Ratings are anonymous, which is the honest trade for a project with no
 * student accounts: it means anyone can rate, and it means the cooldown in
 * lib/ratings is a courtesy rather than a real limit. Said plainly there
 * rather than dressed up as security.
 */
export default function RideRatingCard() {
  const { t, lang } = useLang();
  const [ratings, setRatings] = useState<RideRating[]>([]);
  const [line, setLine] = useState(busLines[0]?.code ?? "");
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => {
    if (!isCloudConfigured()) return;
    cloudFetchRatings()
      .then(setRatings)
      // A rating board that cannot load is not worth an error screen; the
      // card simply shows no averages.
      .catch(() => setRatings([]));
  };

  useEffect(load, []);

  const codes = busLines.map((l) => l.code);
  const summary = summarise(ratings, codes);
  const blocked = recentlyRated(line);

  const send = async () => {
    if (stars < 1) return;
    if (blocked) {
      setNote({ ok: false, text: t("rate.already") });
      return;
    }
    setBusy(true);
    const err = await cloudRateRide({ line, stars, comment });
    setBusy(false);
    if (err) {
      setNote({ ok: false, text: t("rate.failed") });
      return;
    }
    markRated(line);
    setStars(0);
    setComment("");
    setNote({ ok: true, text: t("rate.thanks") });
    load();
  };

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="card-title">{t("rate.title")}</h3>
        <span className="text-xs text-slate-400">{t("rate.subtitle")}</span>
      </div>

      {/* What everyone else thinks */}
      <div className="space-y-2">
        {summary.map((s) => (
          <div
            key={s.line}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/70 px-3 py-2"
          >
            <span className="text-sm font-medium text-slate-200">{s.line}</span>
            <Stars average={s.average} />
            <span className="text-sm font-semibold tabular-nums text-white">
              {formatAverage(s.average)}
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {s.count === 0
                ? t("rate.none")
                : `${s.count} ${t(s.count === 1 ? "rate.count.one" : "rate.count")}`}
            </span>
          </div>
        ))}
      </div>

      {/* Leave your own */}
      <div className="mt-5 border-t border-slate-800/70 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="rate-line">
            {t("rate.prompt")}
          </label>
          <select
            id="rate-line"
            value={line}
            onChange={(e) => {
              setLine(e.target.value);
              setNote(null);
            }}
            className="rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-1.5 text-sm text-slate-200"
          >
            {busLines.map((l) => (
              <option key={l.code} value={l.code}>
                {lineNameIn(l.code, lang)}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1" role="group" aria-label={t("rate.prompt")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n}`}
                aria-pressed={stars === n}
                onClick={() => {
                  setStars(n);
                  setNote(null);
                }}
                // p-1.5 rather than p-0.5: the star glyph is 18px, which left a
                // 22px target - under the 24px minimum for a touch control.
                className="rounded p-1.5 transition-transform hover:scale-110"
              >
                <Star fill={n <= stars ? "full" : "none"} />
              </button>
            ))}
          </div>
        </div>

        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={300}
          placeholder={t("rate.comment")}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
        />

        <button
          onClick={send}
          disabled={busy || stars < 1}
          className="mt-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? t("rate.sending") : t("rate.submit")}
        </button>

        {note && (
          <p
            className={`mt-2 text-xs ${note.ok ? "text-accent-400" : "text-rose-300"}`}
            role="status"
          >
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
