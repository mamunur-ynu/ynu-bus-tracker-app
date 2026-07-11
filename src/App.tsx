import { useState } from "react";
import Header from "./components/Header";
import OverviewCards from "./components/OverviewCards";
import ShortestRouteDemo from "./components/ShortestRouteDemo";
import RouteBoardReference from "./components/RouteBoardReference";
import RouteTimeline from "./components/RouteTimeline";
import PassengerQueuePanel from "./components/PassengerQueuePanel";
import CapacityAlertPanel from "./components/CapacityAlertPanel";
import PeakHourTimeline from "./components/PeakHourTimeline";
import DataTables from "./components/DataTables";
import ReportSummary from "./components/ReportSummary";
import LiveEditor from "./components/LiveEditor";

// Main dashboard layout. A simple tab switches between the read-only
// dashboard and the new interactive editor (version 2).
export default function App() {
  const [tab, setTab] = useState<"dashboard" | "editor">("dashboard");

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "border border-brand-500/50 bg-brand-500/15 text-brand-400"
        : "border border-slate-700 bg-ink-900 text-slate-300"
    }`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
      <Header />

      <div className="mb-6 flex gap-2">
        <button
          className={tabClass(tab === "dashboard")}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={tabClass(tab === "editor")}
          onClick={() => setTab("editor")}
        >
          Live Editor (v2)
        </button>
      </div>

      {tab === "editor" && <LiveEditor />}

      <div className={`space-y-6 ${tab === "dashboard" ? "" : "hidden"}`}>
        <OverviewCards />

        <ShortestRouteDemo />

        <p className="text-xs text-slate-500">
          The route visualization is based on a Yunnan University campus map and
          campus bus route-board reference.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <RouteBoardReference />
          <RouteTimeline />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CapacityAlertPanel />
          </div>
          <ReportSummary />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <PassengerQueuePanel />
          <div className="lg:col-span-2">
            <PeakHourTimeline />
          </div>
        </div>

        <DataTables />
      </div>

      <footer className="mt-10 border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
        <p>
          This is a visual companion dashboard for the C++ console project. The
          C++ system remains the main deliverable.
        </p>
        <p className="mt-1">
          Built with React, TypeScript, Vite, Tailwind CSS, and a native SVG map
          overlay. No backend, no database, no external chart or map libraries.
        </p>
      </footer>
    </div>
  );
}
