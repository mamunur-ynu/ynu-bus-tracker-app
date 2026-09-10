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

**Cloud permissions.** Moving from local state to Supabase surfaced a real production issue: with the new Supabase key system, row-level-security policies alone weren't enough — writes failed with "permission denied." I fixed it by adding explicit `GRANT`s on the tables and sequences to the `anon` and `authenticated` roles. That fixed the admin's writes, but a later audit found the RLS *policy* itself was still too broad: it granted `anon` full INSERT/UPDATE/DELETE, not just SELECT. A GRANT and an RLS policy are two independent gates, and I had only tested "does the admin's write work," not "does a stranger's write fail" — so the admin-only claim below wasn't actually true at the database level. Anyone who read the Supabase URL and public key out of the site's own JavaScript bundle (necessarily public, since the browser needs it) could have written or deleted campus data directly through the REST API, bypassing the login screen entirely. I replaced the single permissive policy with separate ones — public SELECT, and INSERT/UPDATE/DELETE restricted to the `authenticated` role — and confirmed it with real unauthenticated requests: reads still succeed, a write now comes back `401` with a row-level-security error.

**Realtime without a backend.** Instead of building a server, I used Supabase Realtime (`postgres_changes`) so a change on one screen appears on all others within a second — a live product feel with zero custom backend code.

**Making 3D feel real, not gimmicky.** The first 3D pass looked like floating boxes. I iterated: shadows and tone mapping, buildings with lit-window canvas textures, wide asphalt roads with lane markings and green verges, street lamps, crosswalks, and traffic lights that cycle green → amber → red with a real second-countdown. I also fixed buses cutting across grass by making them retrace their route (out-and-back) so they always stay on drawn roads.

**Designing for an unreliable network, not just an offline one.** My campus network (and mainland China generally) doesn't always reach services hosted abroad reliably — Netlify and Supabase included; the Great Firewall causes real packet loss and intermittent blocking, independent of anything in my code. Rather than assume the realtime WebSocket would always connect, I made the client track the actual subscription state and fall back to polling the REST API every 20 seconds when it can't — instead of showing a "connected" status that would be a lie. Combined with the PWA's offline-first shell and the localStorage fallback, the app has three real layers: realtime sync -> polling -> fully offline, so a flaky network degrades the experience instead of breaking it.

**Free-tier infrastructure fails silently too.** A production incident taught me a second lesson past network flakiness: Supabase's free tier auto-pauses a project after a week of no activity, and a paused project makes every query fail. My client-side code was treating a failed query exactly like an empty table — so the pause silently wiped the Live Editor's stops and routes for every visitor instead of showing an error. I fixed both ends: `cloudFetch` now surfaces a real query failure instead of swallowing it into `[]`, and the editor never lets an empty cloud result overwrite data already on screen. The underlying lesson generalizes past this one bug — treat "the request failed" and "the data is empty" as different states everywhere a network call meets a UI, because conflating them turns an infrastructure hiccup into a data-loss bug.

**Code-splitting has its own failure mode.** Lazy-loading the 3D tab (previous paragraph) keeps the initial load light, but I found a real crash it can cause: a visitor whose tab (or PWA cache) is running a slightly older build hits `import("./MiniCity3D")` and asks the server for that build's exact chunk filename -- one that a newer deploy has since replaced with a different hash. The import rejects, and left uncaught that took the *entire app* down to the generic error boundary, not just the 3D tab. I caught it in production by actually opening the deployed site's 3D City tab myself rather than trusting the code review that said "it's just a lazy import." The fix treats a failed dynamic import as a stale-cache signal rather than a real error: catch it, reload the page once (a reload fetches the current `index.html` and a matching chunk manifest), and only let the error through if it fails again after that reload. Same lesson as the two production incidents above: a failure mode that only shows up post-deploy, on a real tab, with real caching -- not in `npm run dev` -- needs someone to actually click around the live site, not just read the diff.

**Shipping responsibly.** Only the Supabase *publishable* key lives in the client; the secret key never touches the frontend. The heavy Three.js bundle is code-split and lazy-loaded so it only downloads when the 3D tab is opened, keeping the initial load light.

**A brand, not just a repaint.** After the app was working end to end, I gave it an actual product identity instead of leaving it as an unnamed student demo: "YNU Smart Mobility," with the tagline "Your Campus. Your Route. Your Journey." I picked a real two-color system (Royal Blue `#2563EB` and Electric Green `#22C55E` over a Deep Navy base) and, rather than only changing a title bar, ran it all the way through the product: the primary bus line (Z52) now *is* the brand blue, the second line (Z53) *is* the brand green, the card-title gradient and every active/focus state pick up the same two colors, and the display font moved from Sora to Poppins for a more distinct product feel next to Inter's body text. A design system means one color decision propagates everywhere it appears instead of being redone by hand in twenty places — which is also why the color tokens live in one spot (`tailwind.config.js`) rather than being copy-pasted as hex codes through every component.

**Answering the question the rider actually has.** The dashboard could show everything about the network, but a student standing at a stop has exactly one question: *when is my bus?* So I added a Home screen that leads with a single answer — the next bus at their stop, how full it is, and one button to watch it move — and made it the landing tab. Building it meant the ETA maths had to come out of `LiveArrivals.tsx`, where it had been sitting inside a component, and move into `lib/arrivals.ts`. That was the real win: two screens now read the same numbers from one engine instead of each doing its own arithmetic and slowly disagreeing, and because the logic is now plain functions it finally has unit tests — including the wrap-around case, where a bus that has *just* left must read as a whole loop away rather than a negative countdown. I checked those tests earn their keep by deliberately removing the modulo: three of them failed, which is exactly what a regression test is for. Rendering the screen also caught a design bug no amount of code review would have: at hero size the countdown `10:24` reads as the time of day, not as ten minutes away, so it now says "11 min".

**Hardcoded data is a feature that doesn't exist yet.** The fleet lived in a TypeScript array, which quietly meant the university could not put a bus on the road without me editing the source and redeploying. Moving it into a `buses` table finished the job the stops and routes tables had started, and let me tighten the security model I'd got wrong once already: this table grants `anon` **only** `SELECT`, so even if a future RLS policy were written too loosely, an anonymous visitor still could not write to it — the privilege simply isn't there. I checked that with real unauthenticated requests rather than by reading the policy: a read returns `200` with the fleet, while an insert and a delete both come back `401 permission denied`. Making the fleet live also surfaced a bug hiding in the dashboard: its count-up animation ran exactly once and then refused to run again, which was invisible while every number was a constant but would have pinned the bus count to its seed value forever now that the real number arrives a moment after the page loads. The general lesson is that turning static data dynamic doesn't just add a feature — it re-tests every assumption the old constants were quietly holding up.

## What I learned

- How to take an academic algorithm and wrap it in a real, deployable product.
- Practical cloud database security (RLS + GRANTs), auth gating, and realtime subscriptions.
- Performance trade-offs on the web: code-splitting, lazy loading, and keeping a 3D scene at 60 fps.
- The discipline of continuous deployment — every commit is type-checked, built, and shipped automatically.

## Result

A live, installable, bilingual web app that demonstrates the same routing idea as the C++ project, but as a product people can actually use — from a shortest-route search to a real-time 3D operations view of the campus.
