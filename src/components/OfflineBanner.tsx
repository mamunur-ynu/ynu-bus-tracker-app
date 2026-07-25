import { useEffect, useState } from "react";
import { useLang } from "../lib/i18n";

// Campus wifi drops often, and the app is a PWA that keeps working offline.
// This tells the user what still works instead of leaving them guessing.
export default function OfflineBanner() {
  const { lang } = useLang();
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine
  );

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200"
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
      {lang === "zh"
        ? "当前离线 —— 地图和路线搜索仍可使用，云端更新将在恢复后同步。"
        : "You are offline — the map and route search still work; cloud updates resume when you reconnect."}
    </div>
  );
}
