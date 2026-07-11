# Yunnan University Smart Campus Bus Tracker (Web App, v2)

A real-time, cloud-backed web application for tracking campus shuttle buses and
finding the shortest route across the Yunnan University Chenggong campus. It is
the web companion to a C++ console project of the same name and grew into a full
full-stack product with a live database, authentication, and continuous
deployment.

**Live demo:** https://ynu-bus-tracker.netlify.app

---

## Features

- **Interactive campus map** with the real Yunnan University map and bilingual
  (English / Chinese) stop labels.
- **Shortest route search** computed live by a Dijkstra function written in
  TypeScript.
- **Animated bus** that travels along the selected shortest path.
- **Cloud database** (Supabase / PostgreSQL) — stops and routes are stored
  online and shared across devices.
- **Real-time sync** — a change made on one screen appears instantly on every
  other open screen.
- **Admin login** (Supabase Auth) — only an admin can add, edit, or delete data;
  everyone else has a read-only view.
- **Full CRUD** — add and delete stops and routes.
- **Passenger crowding** — set the number of waiting passengers per stop and see
  the busiest stop highlighted.
- **Installable (PWA)** — can be added to a phone home screen and opened like a
  native app.
- **Continuous deployment (CI/CD)** — every push to GitHub is built and deployed
  automatically by Netlify.

## Tech Stack

| Layer | Technology |
|------|------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Algorithm | Dijkstra shortest path (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Realtime & Auth | Supabase Realtime, Supabase Auth |
| Hosting / CI-CD | Netlify (auto-deploy from GitHub) |
| Mobile | Progressive Web App (installable) |

## Run Locally

```bash
npm install
npm run dev
```

Then open the local address that Vite prints (for example http://localhost:5173).

To connect the cloud database, add your Supabase project URL and publishable key
in `src/lib/supabaseConfig.ts`. Without them, the app still runs using browser
storage only.

## Build

```bash
npm run build
```

The production files are written to the `dist` folder.

## Project Context

This web app is a companion to the C++ final course project "Yunnan University
Smart Campus Bus Tracker and Route Optimizer" for the School of Software and
Artificial Intelligence, Yunnan University. The C++ console system remains the
main academic deliverable; this web app extends the same idea into a live,
cloud-based product.

## Author

MAMUN MD MAMUNUR RASHID — Artificial Intelligence, Yunnan University.
