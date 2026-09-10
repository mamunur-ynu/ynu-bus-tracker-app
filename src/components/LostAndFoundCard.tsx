import { useEffect, useState } from "react";
import { useLang } from "../lib/i18n";
import { busLines, getStop, stops } from "../data/campusData";
import {
  cloudFetchLostItems,
  cloudReportLostItem,
  cloudResolveLostItem,
  isCloudConfigured,
  onAuthChange,
} from "../lib/cloud";
import type { LostItem } from "../lib/cloud";

/** "3 hours ago", without pulling in a date library for one label. */
function ago(iso: string | undefined, lang: "en" | "zh"): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (!Number.isFinite(mins)) return "";
  if (mins < 60) return lang === "zh" ? `${mins} 分钟前` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === "zh" ? `${hrs} 小时前` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return lang === "zh" ? `${days} 天前` : `${days}d ago`;
}

/**
 * A lost-property board for the campus buses.
 *
 * Reading is open to everyone, because the person who left a bag on the Z52
 * has to be able to find it without an account. Posting is open too. Only a
 * signed-in admin can mark an item returned - otherwise any passer-by could
 * quietly hide someone else's lost wallet - and the sign-in state below is
 * only used to decide whether to offer that button; the database enforces it
 * regardless of what this component draws.
 */
export default function LostAndFoundCard() {
  const { t, lang } = useLang();
  const [items, setItems] = useState<LostItem[]>([]);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [kind, setKind] = useState<"lost" | "found">("lost");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [line, setLine] = useState("");
  const [nearStop, setNearStop] = useState("");
  const [contact, setContact] = useState("");

  const load = () => {
    if (!isCloudConfigured()) return;
    cloudFetchLostItems()
      .then(setItems)
      .catch(() => setItems([]));
  };

  useEffect(() => {
    load();
    return onAuthChange((email) => setIsAdmin(Boolean(email)));
  }, []);

  const post = async () => {
    if (title.trim().length < 2) {
      setNote({ ok: false, text: t("lost.needtitle") });
      return;
    }
    setBusy(true);
    const err = await cloudReportLostItem({
      kind,
      title,
      details,
      line: line || undefined,
      nearStop: nearStop ? Number(nearStop) : null,
      contact,
    });
    setBusy(false);
    if (err) {
      setNote({ ok: false, text: t("lost.failed") });
      return;
    }
    setTitle("");
    setDetails("");
    setContact("");
    setOpen(false);
    setNote({ ok: true, text: t("lost.posted") });
    load();
  };

  const resolve = async (id: string) => {
    const err = await cloudResolveLostItem(id);
    if (!err) load();
  };

  const field =
    "w-full rounded-lg border border-slate-700 bg-ink-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500";

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="card-title">{t("lost.title")}</h3>
        <span className="text-xs text-slate-400">{t("lost.subtitle")}</span>
      </div>

      <button
        onClick={() => {
          setOpen((v) => !v);
          setNote(null);
        }}
        className="rounded-full border border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-200 hover:border-brand-500/50"
      >
        {open ? t("lost.cancel") : t("lost.report")}
      </button>

      {open && (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-800/70 p-4">
          <div className="flex gap-2">
            {(["lost", "found"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  kind === k
                    ? "bg-brand-500/20 text-brand-300"
                    : "border border-slate-700 text-slate-400"
                }`}
              >
                {t(k === "lost" ? "lost.kind.lost" : "lost.kind.found")}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder={t("lost.what")}
            className={field}
          />
          <input
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={400}
            placeholder={t("lost.details")}
            className={field}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={line}
              onChange={(e) => setLine(e.target.value)}
              aria-label={t("lost.line")}
              className={field}
            >
              <option value="">{t("lost.anyline")}</option>
              {busLines.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.displayName}
                </option>
              ))}
            </select>
            <select
              value={nearStop}
              onChange={(e) => setNearStop(e.target.value)}
              aria-label={t("lost.stop")}
              className={field}
            >
              <option value="">{t("lost.anystop")}</option>
              {stops.map((s) => (
                <option key={s.id} value={s.id}>
                  {lang === "zh" ? s.chineseName : s.englishName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={120}
              placeholder={t("lost.contact")}
              className={field}
            />
            {/* Said before they type, not after: this board is public. */}
            <p className="mt-1.5 text-[11px] text-amber-300/80">
              {t("lost.contact.warning")}
            </p>
          </div>

          <button
            onClick={post}
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? t("lost.sending") : t("lost.send")}
          </button>
        </div>
      )}

      {note && (
        <p
          className={`mt-3 text-xs ${note.ok ? "text-accent-400" : "text-rose-300"}`}
          role="status"
        >
          {note.text}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400">{t("lost.empty")}</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-800/70 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.kind === "lost"
                      ? "bg-rose-500/15 text-rose-300"
                      : "bg-accent-500/15 text-accent-400"
                  }`}
                >
                  {t(item.kind === "lost" ? "lost.kind.lost" : "lost.kind.found")}
                </span>
                <span className="text-sm font-medium text-slate-100">
                  {item.title}
                </span>
                {item.status === "resolved" && (
                  <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-[10px] text-slate-300">
                    {t("lost.resolved")}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-slate-500">
                  {ago(item.createdAt, lang)}
                </span>
              </div>

              {item.details && (
                <p className="mt-1 text-xs text-slate-400">{item.details}</p>
              )}

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                {item.line && <span>{item.line}</span>}
                {item.nearStop != null && (
                  <span>
                    {lang === "zh"
                      ? getStop(item.nearStop)?.chineseName
                      : getStop(item.nearStop)?.englishName}
                  </span>
                )}
                {item.contact && (
                  <span className="text-slate-400">{item.contact}</span>
                )}
                {isAdmin && item.status !== "resolved" && item.id && (
                  <button
                    onClick={() => resolve(item.id!)}
                    className="ml-auto rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-accent-500/50"
                  >
                    {t("lost.markreturned")}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
