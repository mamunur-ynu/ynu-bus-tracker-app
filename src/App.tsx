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
import StudentHome from "./components/StudentHome";
import FleetPanel from "./components/FleetPanel";
import StopGpsCapture from "./components/StopGpsCapture";
import DriverConsole from "./components/DriverConsole";
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

// Leaflet is another heavy dependency only one tab needs, so it gets the same
// lazy-load plus stale-chunk reload guard as the 3D city above.
type LiveBusMapModule = typeof import("./components/LiveBusMap");

function loadLiveBusMap(): Promise<LiveBusMapModule> {
  return import("./components/LiveBusMap").catch((err) => {
    const key = "live-map-reload-attempted";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      window.location.reload();
      return new Promise<LiveBusMapModule>(() => {});
    }
    throw err;
  });
}

const LiveBusMap = lazy(loadLiveBusMap);
import { useLang, type I18nKey } from "./lib/i18n";

type Tab = "home" | "dashboard" | "live" | "map" | "ai" | "driver" | "editor";
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

// The app's top-level tabs, with a small icon each for the mobile bottom bar.
// `d` is an SVG path drawn on a 24x24 stroke grid.
const tabs: { id: Tab; labelKey: I18nKey; d: string }[] = [
  {
    id: "home",
    labelKey: "tab.home",
    d: "M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5",
  },
  {
    id: "live",
    labelKey: "tab.live",
    d: "M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  },
  {
    id: "dashboard",
    labelKey: "tab.dashboard",
    d: "M4 13h6V4H4v9zm10 7h6v-9h-6v9zM4 20h6v-4H4v4zm10-11h6V4h-6v5z",
  },
  {
    id: "map",
    labelKey: "tab.map",
    d: "M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zm0 0v13m6-10.5v13",
  },
  {
    id: "ai",
    labelKey: "tab.ai",
    d: "M12 3a4 4 0 0 1 4 4v.2A2.8 2.8 0 0 1 18.8 10v5.2A2.8 2.8 0 0 1 16 18H8a2.8 2.8 0 0 1-2.8-2.8V10A2.8 2.8 0 0 1 8 7.2V7a4 4 0 0 1 4-4zM9.5 12h.01m4.99 0h.01",
  },
  {
    id: "driver",
    labelKey: "tab.driver",
    d: "M5 17h14M6 17V9.5L7.5 5h9L18 9.5V17M8.5 9h7M8 13h.01M16 13h.01M7 17v2H5.5v-2M17 17v2h1.5v-2",
  },
  {
    id: "editor",
    labelKey: "tab.editor",
    d: "M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z",
  },
];

// Main layout. A top tab switches between the read-only dashboard and the
// interactive live editor. Inside the dashboard, a section selector shows one
// focused view at a time instead of stacking every panel together.
export default function App() {
  const [tab, setTab] = useState<Tab>("home");
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
    // The extra bottom padding on phones keeps the footer clear of the fixed
    // bottom nav bar, which otherwise sits on top of it.
    <div className="mx-auto max-w-6xl px-4 pt-12 pb-28 sm:pb-12 md:px-8">
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

      {/* One tab list drives both the desktop pills and the mobile bottom
          bar, so the two can never fall out of sync. */}
      <nav aria-label="Main sections" className="mb-8 hidden flex-wrap justify-center gap-2 sm:flex">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tabClass(tab === item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      <main id="main">
      <OfflineBanner />
      {tab === "home" && <StudentHome onTrackLive={() => setTab("live")} />}

      {tab === "live" && (
        <Suspense
          fallback={<div className="skeleton h-[420px] w-full rounded-2xl md:h-[520px]" />}
        >
          <LiveBusMap />
        </Suspense>
      )}

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

      {tab === "driver" && <DriverConsole />}

      {tab === "editor" && (
        <div className="space-y-8">
          <LiveEditor />
          <FleetPanel />
          <StopGpsCapture />
        </div>
      )}

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

            {/*
              items-start on every dashboard grid.
              CSS grid stretches every cell to the height of the tallest one
              by default, so a short card sitting beside a long one grew a
              huge empty tail - the route board carried about 400px of blank
              panel, and the peak-hour timeline beside the queue list nearly
              900px. items-start lets each card be exactly as tall as its own
              contents.
            */}
            {section === "routes" && (
              <div className="grid items-start gap-8 lg:grid-cols-2">
                <RouteBoardReference />
                <RouteTimeline />
              </div>
            )}

            {section === "capacity" && (
              <>
                <CapacityAlertPanel />
                <div className="grid items-start gap-8 lg:grid-cols-2">
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

      {/* Mobile bottom navigation. Phones get a thumb-reachable bar in place
          of the wrapping pill row, which on a narrow screen pushed the actual
          content most of a scroll below the fold. Hidden from screen readers
          because it duplicates the nav above rather than adding anything. */}
      <nav
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-ink-950/90 backdrop-blur-lg sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch justify-around">
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                tabIndex={-1}
                className={`flex flex-1 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-semibold transition ${
                  active ? "text-brand-400" : "text-slate-500"
                }`}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.d} />
                </svg>
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      </nav>

      <Toaster />
    </div>
  );
}
