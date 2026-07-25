import { useState } from "react";
import Header from "./components/Header";
import OverviewCards from "./components/OverviewCards";
import ShortestRouteDemo from "./components/ShortestRouteDemo";
import LiveArrivals from "./components/LiveArrivals";
import RouteBoardReference from "./components/RouteBoardReference";
import RouteTimeline from "./components/RouteTimeline";
import PassengerQueuePanel from "./components/PassengerQueuePanel";
import CapacityAlertPanel from "./components/CapacityAlertPanel";
import PeakHourTimeline from "./components/PeakHourTimeline";
import DataTables from "./components/DataTables";
import ReportSummary from "./components/ReportSummary";
import LiveEditor from "./components/LiveEditor";
import Toaster from "./components/Toaster";
import { useLang, type I18nKey } from "./lib/i18n";

type Tab = "dashboard" | "editor";
type Section = "overview" | "routes" | "capacity" | "data";

const sections: {
  id: Section;
  labelKey: I18nKey;
  active: string;
  dot: string;
}[] = [
  {
    id: "overview",
    labelKey: "section.overview",
    active: "bg-sky-500/15 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.25)]",
    dot: "bg-sky-400",
  },
  {
    id: "routes",
    labelKey: "section.routes",
    active:
      "bg-emerald-500/15 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.25)]",
    dot: "bg-emerald-400",
  },
  {
    id: "capacity",
    labelKey: "section.capacity",
    active:
      "bg-amber-500/15 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.25)]",
    dot: "bg-amber-400",
  },
  {
    id: "data",
    labelKey: "section.data",
    active:
      "bg-violet-500/15 text-violet-300 shadow-[0_0_18px_rgba(139,92,246,0.25)]",
    dot: "bg-violet-400",
  },
];

// Main layout. A top tab switches between the read-only dashboard and the
// interactive live editor. Inside the dashboard, a section selector shows one
// focused view at a time instead of stacking every panel together.
export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [section, setSection] = useState<Section>("overview");
  const { lang, setLang, t } = useLang();

  const tabClass = (active: boolean) =>
    `rounded-full px-6 py-2 text-sm font-semibold transition ${
      active
        ? "border border-brand-500/50 bg-brand-500/15 text-brand-400 shadow-[0_0_20px_rgba(56,189,248,0.15)]"
        : "border border-slate-700/70 bg-white/[0.03] text-slate-400 hover:text-slate-200"
    }`;

  const langBtn = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition ${
      active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
      <div className="mb-4 flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-800/80 bg-white/[0.02] p-1">
          <button
            className={langBtn(lang === "en")}
            onClick={() => setLang("en")}
            aria-label="Switch to English"
          >
            EN
          </button>
          <button
            className={langBtn(lang === "zh")}
            onClick={() => setLang("zh")}
            aria-label="切换到中文"
          >
            中文
          </button>
        </div>
      </div>

      <Header />

      <div className="mb-8 flex justify-center gap-2">
        <button className={tabClass(tab === "dashboard")} onClick={() => setTab("dashboard")}>
          {t("tab.dashboard")}
        </button>
        <button className={tabClass(tab === "editor")} onClick={() => setTab("editor")}>
          {t("tab.editor")}
        </button>
      </div>

      {tab === "editor" && <LiveEditor />}

      {tab === "dashboard" && (
        <>
          <div className="mb-10 flex justify-center">
            <div className="inline-flex flex-wrap justify-center gap-1 rounded-full border border-slate-800/80 bg-white/[0.02] p-1.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition ${
                    section === s.id
                      ? s.active
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${s.dot}`}
                  />
                  {t(s.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div key={section} className="animate-fadeIn space-y-8">
            {section === "overview" && (
              <>
                <OverviewCards />
                <LiveArrivals />
                <ShortestRouteDemo />
              </>
            )}

            {section === "routes" && (
              <div className="grid gap-8 lg:grid-cols-2">
                <RouteBoardReference />
                <RouteTimeline />
              </div>
            )}

            {section === "capacity" && (
              <>
                <CapacityAlertPanel />
                <div className="grid gap-8 lg:grid-cols-2">
                  <PassengerQueuePanel />
                  <PeakHourTimeline />
                </div>
              </>
            )}

            {section === "data" && (
              <>
                <ReportSummary />
                <DataTables />
              </>
            )}
          </div>
        </>
      )}

      <footer className="mt-14 border-t border-slate-800/70 pt-6 text-center text-xs text-slate-500">
        {t("footer.built")}
      </footer>

      <Toaster />
    </div>
  );
}
