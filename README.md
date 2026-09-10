<div align="center">

# 🚌 YNU Smart Mobility

### Your Campus. Your Route. Your Journey.

A full-stack web app with a live **3D city view**, Dijkstra route optimization, cloud database, real-time sync, admin auth, and continuous deployment — the web companion to a C++ course project at Yunnan University. (Formerly "Smart Campus Bus Tracker" — same project, rebranded.)

[![build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![lighthouse-performance](https://img.shields.io/badge/lighthouse_performance-94-brightgreen)](#)
[![lighthouse-accessibility](https://img.shields.io/badge/lighthouse_accessibility-97-brightgreen)](#)
[![lighthouse-best--practices](https://img.shields.io/badge/lighthouse_best--practices-96-brightgreen)](#)
[![lighthouse-seo](https://img.shields.io/badge/lighthouse_seo-92-brightgreen)](#)
[![PWA](https://img.shields.io/badge/PWA-installable-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](#)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](#)

**[▶ Live demo](https://ynu-bus-tracker.netlify.app)**

![Demo](docs/demo.gif)

</div>

---

## ✨ Overview

Smart Campus Bus Tracker turns a classic C++ data-structures project into a live, production-style product. It shows the Yunnan University shuttle network on an interactive map, computes the shortest route between any two stops with **Dijkstra's algorithm**, and renders a real-time **3D miniature city** where buses drive the real route-board loops, pause at stops, and obey traffic lights with second-countdowns.

Everything is backed by a real cloud database with live sync across devices, gated admin editing, and automatic deployment on every push.

## 📊 At a glance

| | |
|---|---|
| Campus stops · route edges | 12 · 10 |
| App sections | 7 (Home · Live Map · Dashboard · 3D City · Ask AI · Driver · Live Editor) |
| Bus lines simulated in real time | 2 (Z52, Z53) |
| Route search | Dijkstra, computed client-side in **< 1 ms** |
| Initial JS payload | **~132 KB gzipped**, split into app / React / Supabase vendor chunks so a code change doesn't invalidate the whole cache — the 3D scene is a separate lazy chunk (135 KB gzipped, loaded only when that tab opens) |
| Imagery | route board optimised **4.7 MB → 282 KB** (−94%) |
| Offline | full app shell + campus imagery precached (PWA, 15 entries) |
| Tests | 233 unit tests, run on every push by GitHub Actions |
| Accessibility | skip link, landmarks, `aria-pressed`/`aria-current`, live regions, reduced-motion, `<html lang>` follows the toggle |
| Languages | English + 中文, full UI toggle |
| Data safety | admin can export/import a full JSON backup — works with zero network |

*Lighthouse scores measured with the Lighthouse CLI against the production build (`npm run build && npm run preview`); real-world scores vary with network and device.*

## 🔍 What is real, what is simulated, what is unproven

Every project of this kind mixes real data with stand-ins. Rather than leave a
reader to guess which is which, here is the line, drawn explicitly.

### Real

| Thing | Why it counts as real |
|---|---|
| Dijkstra shortest path | Genuinely computed in TypeScript at request time, with unit tests. Nothing is looked up from a table of answers. |
| Route network (Z52 / Z53) | Stops and travel times were read off the campus route board — the photograph in the Routes tab is the source. |
| Cloud database | Supabase PostgreSQL. Row-level security is enforced by the database, and was tested by impersonating an anonymous visitor, not by reading the policy text. |
| Realtime sync + admin auth | Supabase Realtime and Supabase Auth. A change on one device really does appear on another. |
| Driver GPS | `navigator.geolocation.watchPosition` — the device's actual GPS, including real speed, heading and accuracy. No synthetic path. |
| Weather | Live measurements from Open-Meteo. Labelled **Kunming**, not "campus", because the API answers for a city coordinate and there is no sensor on campus. |
| Ratings and Lost & Found | Real rows written to, and read from, the database by anyone using the app. |
| Campus map, POI search, walking directions | Amap (高德地图) — real YNU buildings, roads, footpaths and its own POI database, in Chinese. Enabled by setting an Amap key; without one the app falls back to Leaflet/OpenStreetMap. |

### Simulated, and labelled as such in the UI

| Thing | What it actually is |
|---|---|
| Live arrivals countdown | A simulation clock shared by every screen, not the position of a real vehicle. The board says "simulated real-time". |
| Buses in the 3D city | The same simulation, driving the real route loops. They obey the traffic lights, but no bus on campus is being tracked. |
| Waiting-passenger counts | Numbers stored in the database and edited by an admin. There is no sensor counting people at a stop. |
| Onboard / capacity figures | Entered by an admin, for the same reason. |
| Stop positions on the 2D map | Percentages of the map image, not latitude and longitude. |

### Built but not yet proven with real data

These features are implemented and tested in code, but nobody has yet put real
data through them. That is a statement about the project's history, not about
whether the code works.

| Thing | Current state |
|---|---|
| End-to-end GPS tracking | `bus_locations` holds **0 rows**. The driver app has never been carried on a real trip. |
| Real-world stop coordinates | **0 of 12** stops have latitude/longitude captured on site, so real-world distance and ETA cannot be computed yet. |
| Lost & Found | **0** items posted. |
| Ride ratings | **0** ratings submitted. |
| Driver accounts | **1** account exists, used for both admin and driver testing. |
| The Amap integration | Written, type-checked and building, but **never run against the real Amap API** — `webapi.amap.com` is unreachable from the machines it was developed on, and no Amap key exists yet. The no-key fallback and the load-failure path were both tested in a browser; the map, search and walking directions themselves have not been. |

The honest next step for this project is not another feature — it is carrying a
phone along a route to put the first real GPS point in the database.


## 🎬 Screenshots

| Dashboard | 3D City |
|---|---|
| ![Dashboard](docs/dashboard.png) | ![3D City](docs/city3d.png) |

| Live arrivals & ETA | Live editor (admin) |
|---|---|
| ![Live arrivals](docs/arrivals.png) | ![Live editor](docs/editor.png) |

> Or try the **[live demo](https://ynu-bus-tracker.netlify.app)** — open the **3D City** tab and drag to orbit while the buses run.

## 🚀 Features

- **AI campus assistant (tool-calling agent)** — ask *"How long from East Gate to the Library?"* in English or Chinese. An LLM running in a **serverless function** calls the app's own Dijkstra search as a tool, so every travel time it quotes is genuinely computed, never hallucinated. The model key never reaches the browser, and the assistant degrades gracefully to a local rule-based parser when no key is configured.
- **Dijkstra shortest-route** — pick any From/To, choose a bus line, and apply an emergency delay to watch the path re-route live.
- **3D live city (Three.js)** — a night-lit miniature campus with wide roads, lane markings, greenery, buildings with lit windows, street lamps, crosswalks, and **traffic lights with a real second-countdown**. Buses drive the true route loops and pause at each stop.
- **Live arrivals + ETA** — a real-time board counting down each bus's arrival at every stop, with **favourite stops** pinned to the top.
- **Service alerts** — delays and unusually crowded stops surface as an alert strip, the way real transit apps announce disruptions.
- **Step-by-step trip itinerary** — results read as *board → ride N min → alight*, not a flat list of stop names.
- **Works offline** — the app shell and campus imagery are precached, and an offline banner explains what still works.
- **Cloud database (Supabase / PostgreSQL)** — stops and routes are stored online and shared across devices.
- **Real-time sync** — a change on one screen appears instantly on every other open screen.
- **Admin auth** — only a signed-in admin can add / edit / delete; everyone else has a read-only view.
- **Full CRUD + passenger crowding** — add and remove stops/routes and set waiting-passenger counts; the busiest stop is highlighted.
- **JSON backup/restore** — an admin can export the full campus dataset to a file and re-import it later, so a flaky connection to the cloud never risks losing data.
- **Bilingual EN / 中文** — a language toggle translates the whole UI; stop names are bilingual.
- **Real GPS tracking architecture** — a driver signs in, starts a trip, and the browser's Geolocation API publishes real position, speed, heading and accuracy to the database every few seconds; students watch the bus move on a Leaflet map with interpolation and a freshness indicator. (See the table above for what has and has not been exercised with real data.)
- **Weather that answers a rider's question** — current Kunming conditions from Open-Meteo, phrased as advice about waiting at a stop rather than generic weather chatter. Degrades to a clear "unavailable" state with a retry when the network blocks it.
- **Ride ratings** — average stars per line, with an unrated line shown as "no ratings yet" rather than a misleading 0.0.
- **Lost & Found** — report something left on a bus; anyone can read and post, only an admin can mark an item returned.
- **Arrival alerts** — pick a stop and be told a few minutes before the bus. Fires only when the app is not the visible tab, and only once per approach.
- **Fleet management** — an admin can add, edit and retire buses; capacity feeds the rider-facing crowding chip.
- **Installable PWA** — add to a phone home screen and open it like a native app.
- **CI/CD** — every push is built and deployed automatically.

## 🧱 Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React 18 · TypeScript · Vite 5 · Tailwind CSS |
| AI | Gemini / Claude with tool calling, via a Netlify serverless function |
| 3D | Three.js |
| Algorithm | Dijkstra shortest path (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Realtime & Auth | Supabase Realtime · Supabase Auth |
| Hosting / CI-CD | Netlify (auto-deploy from GitHub) |
| Mobile | Progressive Web App |

## 🗺️ Architecture

```mermaid
flowchart LR
    U["User browser<br/>React + TypeScript + Three.js"]
    D["Dijkstra engine<br/>(runs in the browser)"]
    S["Supabase<br/>PostgreSQL · Realtime · Auth"]
    N["Netlify<br/>build + CDN + CI/CD"]
    G["GitHub push"]

    U -->|"read / write stops & routes"| S
    S -->|"realtime updates"| U
    U --> D
    G --> N
    N -->|"deploy"| U
```

## 🧑‍💻 Run locally

```bash
git clone https://github.com/mamunur-ynu/ynu-bus-tracker-app.git
cd ynu-bus-tracker-app
npm install
npm run dev        # open the local URL Vite prints
```

To enable the cloud, add your Supabase URL and publishable key in `src/lib/supabaseConfig.ts`. Without them the app still runs using browser storage.

To enable the **AI assistant**, add a model key in your Netlify site (Site configuration → Environment variables):

| Variable | Provider | Notes |
|---|---|---|
| `AI_API_KEY` (+ optional `AI_BASE_URL`, `AI_MODEL`) | any OpenAI-compatible API | Zhipu GLM, Qwen, Groq, DeepSeek… Defaults to Zhipu `glm-4-flash`, which has a free tier |
| `GEMINI_API_KEY` | Google Gemini | free tier, no card required |
| `ANTHROPIC_API_KEY` | Claude | paid |

Example for Groq: `AI_API_KEY=<key>`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=llama-3.3-70b-versatile`.

The key is only read inside the serverless function — it never reaches the browser. Without any key the assistant automatically falls back to a local rule-based parser that still computes real routes.

### Campus map (Amap 高德地图)

Copy `.env.example` to `.env` and fill in an Amap key to switch the Live Map
tab from OpenStreetMap to Amap's real campus map, with POI search and walking
directions:

| Variable | Where it comes from |
|---|---|
| `VITE_AMAP_KEY` | lbs.amap.com → 控制台 → 应用管理 → 创建新应用 → 添加 Key, service type **Web端(JS API)** |
| `VITE_AMAP_SECURITY_CODE` | the 安全密钥 shown next to that key |

Registering needs a Chinese phone number and real-name verification. Both
values end up in the built JavaScript — that is how Amap's browser API works,
so restrict the key to your own domain in their console.

Two things worth knowing:

- **Coordinates.** Amap renders in GCJ-02 while GPS and this project's stored
  data are WGS-84. Inside China those differ by 100–700 m, so every coordinate
  is converted on the way in and out (`src/lib/gcj02.ts`). Skipping that
  silently draws every bus a few streets from where it is.
- **Bus stops need real coordinates.** Amap will show the campus perfectly
  well without them, but the bus layer — stops, routes, nearest stop, ETA —
  stays empty until each stop's latitude and longitude is captured on site in
  the Live Editor tab. The map says so rather than looking broken.

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build
```

## 📁 Project structure

```
netlify/functions/
  assistant.mts           serverless AI agent (tool calling → Dijkstra)
src/
  App.tsx                 tabs: Home · Live Map · Dashboard · 3D City ·
                          Ask AI · Driver · Live Editor
  algorithms/dijkstra.ts  shortest-path engine (+ unit tests)
  components/
    MiniCity3D.tsx        the Three.js 3D city
    AIAssistant.tsx       chat UI for the assistant
    LiveArrivals.tsx      real-time ETA board
    ShortestRouteDemo.tsx interactive map + route
    LiveEditor.tsx        cloud CRUD + admin auth
    LiveBusMap.tsx        Leaflet map of real GPS positions
    DriverConsole.tsx     driver sign-in, trip start, GPS broadcast
    StudentHome.tsx       rider home: next bus, weather, alerts, ratings
    WeatherPanel.tsx      Open-Meteo conditions and riding advice
    AmapCampus.tsx        Amap campus map, POI search, walking directions
  data/campusData.ts      stops, routes, bus lines
  lib/
    arrivals.ts           one shared simulation clock for every screen
    traffic.ts            signal phases + the rules a bus obeys (tested)
    geo.ts                haversine, bearing, ETA from distance and speed
    weather.ts            Open-Meteo fetch and defensive parsing
    amap.ts               Amap JS API loader and typed surface
    gcj02.ts              WGS-84 <-> GCJ-02 conversion (tested)
    ratings.ts            per-line averages and the rating cooldown
    notify.ts             when an arrival alert may and may not fire
    cloud.ts              Supabase access for every table
```

## 📚 Context

This web app is the companion to the C++ final course project *"Smart Campus Bus Tracker and Route Optimizer"* for the School of Software and Artificial Intelligence, Yunnan University. The C++ console system is the main academic deliverable; this app extends the same idea into a live, cloud-based product.

**→ [C++ repository](https://github.com/mamunur-ynu/yunnan-university-smart-campus-bus-tracker)** — OOP design, STL, Dijkstra, and the 46-page project report.

## 👤 Author

**MAMUN MD MAMUNUR RASHID** — Artificial Intelligence, Yunnan University.

<div align="center">

⭐ If you like this project, consider giving it a star.

</div>
