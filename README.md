<div align="center">

# 🚌 Smart Campus Bus Tracker

### Real-time, cloud-based campus shuttle tracker & route optimizer

A full-stack web app with a live **3D city view**, Dijkstra route optimization, cloud database, real-time sync, admin auth, and continuous deployment — the web companion to a C++ course project at Yunnan University.

[![build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![lighthouse](https://img.shields.io/badge/lighthouse-98-brightgreen)](#)
[![PWA](https://img.shields.io/badge/PWA-installable-blue)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](#)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](#)

**[▶ Live demo](https://ynu-bus-tracker.netlify.app)**

</div>

---

## ✨ Overview

Smart Campus Bus Tracker turns a classic C++ data-structures project into a live, production-style product. It shows the Yunnan University shuttle network on an interactive map, computes the shortest route between any two stops with **Dijkstra's algorithm**, and renders a real-time **3D miniature city** where buses drive the real route-board loops, pause at stops, and obey traffic lights with second-countdowns.

Everything is backed by a real cloud database with live sync across devices, gated admin editing, and automatic deployment on every push.

## 🎬 Screenshots

> Add your images to `docs/screenshots/` and they will appear here.

| Dashboard | 3D City |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![3D City](docs/screenshots/city3d.png) |

| Live Arrivals & ETA | Live Editor (admin) |
|---|---|
| ![Live Arrivals](docs/screenshots/arrivals.png) | ![Editor](docs/screenshots/editor.png) |

## 🚀 Features

- **Dijkstra shortest-route** — pick any From/To, choose a bus line, and apply an emergency delay to watch the path re-route live.
- **3D live city (Three.js)** — a night-lit miniature campus with wide roads, lane markings, greenery, buildings with lit windows, street lamps, crosswalks, and **traffic lights with a real second-countdown**. Buses drive the true route loops and pause at each stop.
- **Live arrivals + ETA** — a real-time board counting down each bus's arrival at every stop.
- **Cloud database (Supabase / PostgreSQL)** — stops and routes are stored online and shared across devices.
- **Real-time sync** — a change on one screen appears instantly on every other open screen.
- **Admin auth** — only a signed-in admin can add / edit / delete; everyone else has a read-only view.
- **Full CRUD + passenger crowding** — add and remove stops/routes and set waiting-passenger counts; the busiest stop is highlighted.
- **Bilingual EN / 中文** — a language toggle translates the whole UI; stop names are bilingual.
- **Installable PWA** — add to a phone home screen and open it like a native app.
- **CI/CD** — every push is built and deployed automatically.

## 🧱 Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React 18 · TypeScript · Vite 5 · Tailwind CSS |
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

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build
```

## 📁 Project structure

```
src/
  App.tsx                 tabs: Dashboard · 3D City · Live Editor
  algorithms/dijkstra.ts  shortest-path engine
  components/
    MiniCity3D.tsx        the Three.js 3D city
    LiveArrivals.tsx      real-time ETA board
    ShortestRouteDemo.tsx interactive map + route
    LiveEditor.tsx        cloud CRUD + admin auth
  data/campusData.ts      stops, routes, bus lines
  lib/                    cloud, persistence, i18n, toast
```

## 📚 Context

This web app is the companion to the C++ final course project *"Smart Campus Bus Tracker and Route Optimizer"* for the School of Software and Artificial Intelligence, Yunnan University. The C++ console system is the main academic deliverable; this app extends the same idea into a live, cloud-based product.

## 👤 Author

**MAMUN MD MAMUNUR RASHID** — Artificial Intelligence, Yunnan University.

<div align="center">

⭐ If you like this project, consider giving it a star.

</div>
