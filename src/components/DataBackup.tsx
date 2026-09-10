import { useRef } from "react";
import type { Stop, Route } from "../data/campusData";
import { toast } from "../lib/toast";
import { useLang } from "../lib/i18n";

interface DataBackupProps {
  stops: Stop[];
  routes: Route[];
  onImport: (stops: Stop[], routes: Route[]) => void;
}

// A manual JSON backup/restore for the campus data. This matters for a
// specific reason: cloud sync (Supabase Realtime) can be unreliable on some
// campus networks (see CASE_STUDY.md), so an admin should always be able to
// save a snapshot to their own computer and load it back later, even with
// zero network at all — no cloud, no server, just a downloaded file.
function isStop(v: unknown): v is Stop {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === "number" &&
    typeof s.englishName === "string" &&
    typeof s.chineseName === "string" &&
    typeof s.x === "number" &&
    typeof s.y === "number" &&
    typeof s.passengerCount === "number"
  );
}

function isRoute(v: unknown): v is Route {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "number" &&
    typeof r.name === "string" &&
    typeof r.sourceStopId === "number" &&
    typeof r.destinationStopId === "number" &&
    typeof r.travelTimeMinutes === "number" &&
    typeof r.delayMinutes === "number"
  );
}

export default function DataBackup({ stops, routes, onImport }: DataBackupProps) {
  const { t } = useLang();
  const fileInput = useRef<HTMLInputElement>(null);

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      stops,
      routes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = payload.exportedAt.slice(0, 10);
    a.href = url;
    a.download = `campus-bus-tracker-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${stops.length} stops · ${routes.length} routes`);
  }

  function pickFile() {
    fileInput.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedStops = parsed?.stops;
      const importedRoutes = parsed?.routes;
      if (
        !Array.isArray(importedStops) ||
        !Array.isArray(importedRoutes) ||
        !importedStops.every(isStop) ||
        !importedRoutes.every(isRoute)
      ) {
        toast.error("That file doesn't look like a valid backup");
        return;
      }
      onImport(importedStops, importedRoutes);
      toast.success(
        `Imported ${importedStops.length} stops · ${importedRoutes.length} routes`
      );
    } catch {
      toast.error("Couldn't read that file — is it a valid backup JSON?");
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-ink-950/40 p-3">
      <p className="mb-1 text-sm font-medium text-slate-200">{t("backup.title")}</p>
      <p className="mb-3 text-xs text-slate-400">
        Save a snapshot to your computer, or load one back — works even with
        no network at all, so a flaky connection to the cloud never risks
        your data.
      </p>
      <div className="flex gap-2">
        <button
          onClick={exportJson}
          className="flex-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200"
        >
          Export JSON
        </button>
        <button
          onClick={pickFile}
          className="flex-1 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200"
        >
          Import JSON
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onFileChosen}
      />
    </div>
  );
}
