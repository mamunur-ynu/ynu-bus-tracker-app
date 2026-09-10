import { lazy, Suspense, useState } from "react";
import Header from "./components/Header";
import OverviewCards from "./components/OverviewCards";
import ShortestRouteDemo from "./components/ShortestRouteDemo";
import LiveArrivals from "./components/LiveArrivals";
import ServiceAlerts from "./components/ServiceAlerts";
import OfflineBanner from "./components/OfflineBanner";
import RouteBoardReference from "./components/RouteBoardReference";
import RouteTimeline from "./components/RouteTimeline";
import PassengerQueuePanel from "./components/PassengerQueuePanel";
import CapacityAlertPanel from "./components/CapacityAlertPanel";
import PeakHourTimeline from "./components/PeakHourTimeline";
import DataTables from "./components/DataTables";
import ReportSummary from "./components/ReportSummary";
import LiveEditor from "./components/LiveEditor";
import AIAssistant from "./components/AIAssistant";
import Toaster from "./components/Toaster";

// The 3D city pulls in three.js, so load it only when its tab is opened.
// A dynamic import like this asks the browser for one specific, hashed
// chunk file (e.g. MiniCity3D-C2Nlq_Uy.js) baked into the bundle that is
// CURRENTLY RUNNING in the visitor's tab. If a newer version of the site
// has been deployed since that tab loaded -- or the PWA served an older
// cached copy of the app shell -- that exact filename may no longer exist
// on the server, because a new build gives every changed chunk a new
// hash. I found this live: opening the 3D City tab on the deployed site
// threw "Failed to fetch dynamically imported module" and took the whole
// app down to the generic crash screen, even though nothing was wrong
// with three.js itself -- the running tab just had a stale reference.
// The fix is to catch exactly that failure and reload the page once. A
// reload fetches the current index.html and the matching chunk manifest,
// so the retry lands on a bundle whose filenames actually exist. The
// sessionStorage guard stops a real, ongoing network outage from
// reloading forever -- after one attempt this session, a genuine failure
// is left to surface normally instead of looping.
type MiniCity3DModule = typeof import("./components/MiniCity3D");

function loadMiniCity3D(): Promise<MiniCity3DModule> {
  return import("./components/MiniCity3D").catch((err) => {
    const reloadedKey = "mini-city-3d-reload-attempted";
    if (!sessionStorage.getItem(reloadedKey)) {
      sessionStorage.setItem(reloadedKey, "1");
      window.location.reload();
      // The page is about to reload; never resolve so React doesn't try
      // to render with no module.
      return new Promise<MiniCity3DModule>(() => {});
    }
    throw err;
  });
}

const MiniCity3D = lazy(loadMiniCity3D);
import { useLang, type I18nKey } from "./lib/i18n";

type Tab = "dashboard" | "map" | "ai" | "editor";
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
    active: "bg-brand-500/15 text-brand-400 shadow-[0_0_18px_rgba(37,99,235,0.25)]",
    dot: "bg-brand-500",
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
        ? "border border-brand-500/50 bg-brand-500/15 text-brand-400 shadow-[0_0_20px_rgba(37,99,235,0.15)]"
        : "border border-slate-700/70 bg-white/[0.03] text-slate-400 hover:text-slate-200"
    }`;

  const langBtn = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold transition ${
      active ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
    }`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
      <div className="mb-4 flex justify-end">
        <div
          role="group"
          aria-label="Language"
          className="inline-flex items-center gap-1 rounded-full border border-slate-800/80 bg-white/[0.02] p-1"
        >
          <button
            className={langBtn(lang === "en")}
            onClick={() => setLang("en")}
            aria-label="Switch to English"
            aria-pressed={lang === "en"}
          >
            EN
          </button>
          <button
            className={langBtn(lang === "zh")}
            onClick={() => setLang("zh")}
            aria-label="切换到中文"
            aria-pressed={lang === "zh"}
          >
            中文
          </button>
        </div>
      </div>

      <Header />

      <nav aria-label="Main sections" className="mb-8 flex flex-wrap justify-center gap-2">
        <button
          className={tabClass(tab === "dashboard")}
          aria-current={tab === "dashboard" ? "page" : undefined}
          onClick={() => setTab("dashboard")}
        >
          {t("tab.dashboard")}
        </button>
        <button
          className={tabClass(tab === "map")}
          aria-current={tab === "map" ? "page" : undefined}
          onClick={() => setTab("map")}
        >
          {t("tab.map")}
        </button>
        <button
          className={tabClass(tab === "ai")}
          aria-current={tab === "ai" ? "page" : undefined}
          onClick={() => setTab("ai")}
        >
          {t("tab.ai")}
        </button>
        <button
          className={tabClass(tab === "editor")}
          aria-current={tab === "editor" ? "page" : undefined}
          onClick={() => setTab("editor")}
        >
          {t("tab.editor")}
        </button>
      </nav>

      <main id="main">
      <OfflineBanner />
      {tab === "map" && (
        <Suspense
          fallback={
            <div className="skeleton h-[420px] w-full rounded-2xl md:h-[520px]" />
          }
        >
          <MiniCity3D />
        </Suspense>
      )}

      {tab === "ai" && <AIAssistant />}

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
                <ServiceAlerts />
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

      </main>

      <footer className="mt-14 border-t border-slate-800/70 pt-6 text-center text-xs text-slate-500">
        {t("footer.built")}
      </footer>

      <Toaster />
    </div>
  );
}
