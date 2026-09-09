# Case Study — Smart Campus Bus Tracker

**Author:** MAMUN MD MAMUNUR RASHID · Artificial Intelligence, Yunnan University
**Live demo:** https://ynu-bus-tracker.netlify.app
**Repo:** https://github.com/mamunur-ynu/ynu-bus-tracker-app

---

## The problem

The Yunnan University Chenggong campus runs a shuttle-bus network, but students have no live way to see where buses are, how long until the next arrival, or the fastest route between two campus points. My C++ course project modeled this system in the console with OOP and a Dijkstra shortest-path search. I wanted to prove I could take that same idea and ship it as a real, live product on the web — something a person could actually open on their phone.

## What I built

A full-stack web application that:

- draws the campus shuttle network on an interactive map and finds the shortest route between any two stops with **Dijkstra's algorithm**, including an "emergency delay" scenario that re-routes in real time;
- renders a **3D miniature city** (Three.js) where buses drive the real route-board loops, pause at stops, and obey traffic lights with live second-countdowns;
- shows a **real-time arrivals board** with per-stop ETA counting down live;
- stores all stops and routes in a **cloud database** (Supabase / PostgreSQL) that syncs instantly across every open device;
- gates editing behind **admin authentication** — guests get a read-only view, an admin can add / edit / delete;
- ships as an installable **PWA** and **auto-deploys** on every push via Netlify CI/CD;
- supports a full **EN / 中文** language toggle.

## Key decisions & challenges

**Keeping the algorithm honest.** The web app re-implements Dijkstra in TypeScript rather than faking the result, so the route shown is genuinely computed — the same logic as the C++ version, now interactive.

**Cloud permissions.** Moving from local state to Supabase surfaced a real production issue: with the new Supabase key system, row-level-security policies alone weren't enough — writes failed with "permission denied." I fixed it by adding explicit `GRANT`s on the tables and sequences to the `anon` and `authenticated` roles, then confirmed guests stay read-only while the admin can write.

**Realtime without a backend.** Instead of building a server, I used Supabase Realtime (`postgres_changes`) so a change on one screen appears on all others within a second — a live product feel with zero custom backend code.

**Making 3D feel real, not gimmicky.** The first 3D pass looked like floating boxes. I iterated: shadows and tone mapping, buildings with lit-window canvas textures, wide asphalt roads with lane markings and green verges, street lamps, crosswalks, and traffic lights that cycle green → amber → red with a real second-countdown. I also fixed buses cutting across grass by making them retrace their route (out-and-back) so they always stay on drawn roads.

**Designing for an unreliable network, not just an offline one.** My campus network (and mainland China generally) doesn't always reach services hosted abroad reliably — Netlify and Supabase included; the Great Firewall causes real packet loss and intermittent blocking, independent of anything in my code. Rather than assume the realtime WebSocket would always connect, I made the client track the actual subscription state and fall back to polling the REST API every 20 seconds when it can't — instead of showing a "connected" status that would be a lie. Combined with the PWA's offline-first shell and the localStorage fallback, the app has three real layers: realtime sync -> polling -> fully offline, so a flaky network degrades the experience instead of breaking it.

**Free-tier infrastructure fails silently too.** A production incident taught me a second lesson past network flakiness: Supabase's free tier auto-pauses a project after a week of no activity, and a paused project makes every query fail. My client-side code was treating a failed query exactly like an empty table — so the pause silently wiped the Live Editor's stops and routes for every visitor instead of showing an error. I fixed both ends: `cloudFetch` now surfaces a real query failure instead of swallowing it into `[]`, and the editor never lets an empty cloud result overwrite data already on screen. The underlying lesson generalizes past this one bug — treat "the request failed" and "the data is empty" as different states everywhere a network call meets a UI, because conflating them turns an infrastructure hiccup into a data-loss bug.

**Shipping responsibly.** Only the Supabase *publishable* key lives in the client; the secret key never touches the frontend. The heavy Three.js bundle is code-split and lazy-loaded so it only downloads when the 3D tab is opened, keeping the initial load light.

## What I learned

- How to take an academic algorithm and wrap it in a real, deployable product.
- Practical cloud database security (RLS + GRANTs), auth gating, and realtime subscriptions.
- Performance trade-offs on the web: code-splitting, lazy loading, and keeping a 3D scene at 60 fps.
- The discipline of continuous deployment — every commit is type-checked, built, and shipped automatically.

## Result

A live, installable, bilingual web app that demonstrates the same routing idea as the C++ project, but as a product people can actually use — from a shortest-route search to a real-time 3D operations view of the campus.
