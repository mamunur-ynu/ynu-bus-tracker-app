// Client side of the AI assistant.
//
// It first tries the serverless function (real LLM with tool calling). If no
// model key is configured, or the network call fails, it degrades gracefully
// to a local rule-based parser so the feature always answers something useful.

import { findShortestRoute } from "../algorithms/dijkstra";
import type { Stop, Route } from "../data/campusData";
import {
  buildLineModels,
  minutesLeft,
  nextBusForStop,
  simElapsedSec,
} from "./arrivals";

export interface AssistantReply {
  text: string;
  source: "ai" | "local";
}

// --- local fallback ---------------------------------------------------------

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, " ").trim();
}

// Everyday names students actually use — dormitory blocks, "main gate", the
// canteen, and so on. Keyed by stop id so the parser understands questions
// like "I'm at Qiu Yuan 7, how do I get to the main gate?".
const NICKNAMES: Record<number, string[]> = {
  1: ["main gate", "east gate", "东门", "正门", "大门"],
  2: ["north gate", "北门"],
  3: ["south gate", "南门"],
  4: ["west gate", "西门"],
  5: ["zehu", "lake", "泽湖"],
  6: ["library", "lib", "图书馆"],
  7: ["lixing", "力行楼", "力行"],
  8: ["hospital", "clinic", "校医院", "医院"],
  9: [
    "engineering college",
    "engineering",
    "现代工学院",
    "工学院",
    "engineering building",
  ],
  10: [
    "dorm",
    "dorms",
    "dormitory",
    "hostel",
    "apartment",
    "student apartment",
    "学生公寓",
    "宿舍",
    "qiu yuan",
    "qiuyuan",
    "楸园",
    "hua yuan",
    "huayuan",
    "桦园",
    "nan yuan",
    "nanyuan",
    "楠园",
    "yi yuan",
    "yiyuan",
    "怡园",
  ],
  11: ["yuweitang", "canteen", "dining hall", "cafeteria", "余味堂", "食堂"],
  12: ["gewu", "格物楼", "格物"],
};

// Names people actually type: the full name, common short forms, and the
// nicknames above — so "East Gate" matches "YNU East Gate" and "东门" matches
// "云南大学东门".
function aliases(s: Stop): string[] {
  const out = [s.englishName, s.chineseName];
  out.push(s.englishName.replace(/^YNU\s+/i, ""));
  out.push(s.chineseName.replace(/^云南大学/, ""));
  out.push(...(NICKNAMES[s.id] ?? []));
  return out.filter((n) => n.trim().length > 0);
}

// Score how well a stop name appears in the question.
function matchStops(question: string, stops: Stop[]): Stop[] {
  const q = normalize(question);
  const hits: { stop: Stop; index: number; len: number }[] = [];
  for (const s of stops) {
    let best: { index: number; len: number } | null = null;
    for (const name of aliases(s)) {
      const n = normalize(name);
      if (!n) continue;
      const i = q.indexOf(n);
      // Prefer the longest alias that matches — it is the most specific.
      if (i >= 0 && (!best || n.length > best.len)) {
        best = { index: i, len: n.length };
      }
    }
    if (best) hits.push({ stop: s, index: best.index, len: best.len });
  }
  // Longest names win when two stops overlap, then keep question order.
  hits.sort((a, b) => (b.len - a.len) || (a.index - b.index));
  const unique: typeof hits = [];
  for (const h of hits) {
    if (!unique.some((u) => u.stop.id === h.stop.id)) unique.push(h);
  }
  return unique.sort((a, b) => a.index - b.index).map((h) => h.stop);
}

/**
 * "When is the next bus at the Library?" - the single most obvious question a
 * rider has, and the one the assistant used to answer worst: with only one
 * stop named there was no route to compute, so it fell through to the generic
 * "tell me a start and a destination" reply.
 *
 * It reads the same arrivals engine and the same shared clock as the Home card
 * and the arrivals board, so the assistant cannot quote a different time from
 * the one on screen. Deliberately says nothing about distance in metres: the
 * app has no real positions to measure, and an invented "700 m away" would be
 * the one part of the answer that is made up.
 */
export function arrivalAnswer(
  stop: Stop,
  stops: Stop[],
  routes: Route[],
  lang: "en" | "zh",
  now: number = Date.now()
): string {
  const zh = lang === "zh";
  const next = nextBusForStop(buildLineModels(), stop.id, simElapsedSec(now));

  if (!next) {
    // The stop exists on the map but no line calls there - point them at the
    // closest stop that a bus actually serves rather than saying "no".
    const served = new Set<number>();
    for (const rt of routes) {
      served.add(rt.sourceStopId);
      served.add(rt.destinationStopId);
    }
    const nearest = stops
      .filter((s) => served.has(s.id) && s.id !== stop.id)
      .map((s) => ({ s, d: Math.hypot(s.x - stop.x, s.y - stop.y) }))
      .sort((a, b) => a.d - b.d)[0]?.s;
    if (nearest) {
      return zh
        ? `${stop.chineseName} 没有公交停靠。最近的停靠站是 ${nearest.chineseName}。`
        : `No bus line stops at ${stop.englishName}. The nearest stop with a service is ${nearest.englishName}.`;
    }
    return zh
      ? `${stop.chineseName} 目前没有公交停靠。`
      : `No bus line currently stops at ${stop.englishName}.`;
  }

  const stopName = zh ? stop.chineseName : stop.englishName;
  const mins = minutesLeft(next.eta);
  const waiting = stop.passengerCount;

  const head =
    next.eta < 0.5
      ? zh
        ? `${next.line.name}（${next.line.code}）正在到达 ${stopName}。`
        : `The ${next.line.name} (${next.line.code}) is arriving at ${stopName} now.`
      : zh
        ? `下一班到 ${stopName} 的是 ${next.line.name}（${next.line.code}），大约还有 ${mins} 分钟。`
        : `The next bus to ${stopName} is the ${next.line.name} (${next.line.code}), in about ${mins} minute${mins === 1 ? "" : "s"}.`;

  if (waiting > 0) {
    return zh
      ? `${head}\n目前该站有 ${waiting} 人候车。`
      : `${head}\nThere ${waiting === 1 ? "is" : "are"} ${waiting} ${waiting === 1 ? "person" : "people"} waiting there right now.`;
  }
  return head;
}

// Does the question look like "when does it get here?" rather than "how do I
// get from A to B?" Kept generous, and in both languages.
function asksAboutArrival(q: string): boolean {
  return /\bwhen\b|\bnext bus\b|\barriv|\bcoming\b|\bdue\b|什么时候|何时|多久|下一班|下班车|几分钟|到站/.test(
    q
  );
}

// Someone asking for directions, as opposed to an arrival time.
function asksForRoute(q: string): boolean {
  return /how do i get|how to get|how long|get to\b|route to|travel to|怎么去|怎么走|如何去|路线/.test(
    q
  );
}

export function localAnswer(
  question: string,
  stops: Stop[],
  routes: Route[],
  lang: "en" | "zh",
  now: number = Date.now()
): string {
  const zh = lang === "zh";
  const found = matchStops(question, stops);

  if (found.length >= 2) {
    const [from, to] = found;
    // Route edges are stored one-way, but a shuttle that runs A→B also comes
    // back B→A, so a return journey must be searchable too.
    const bothWays: Route[] = [
      ...routes,
      ...routes.map((rt) => ({
        ...rt,
        id: rt.id + 10000,
        sourceStopId: rt.destinationStopId,
        destinationStopId: rt.sourceStopId,
      })),
    ];
    const r = findShortestRoute(stops, bothWays, from.id, to.id);
    if (!r.found) {
      // No bus serves this stop — suggest walking to the nearest served one.
      const served = new Set<number>();
      for (const rt of routes) {
        served.add(rt.sourceStopId);
        served.add(rt.destinationStopId);
      }
      const nearest = stops
        .filter((s) => served.has(s.id) && s.id !== from.id)
        .map((s) => ({ s, d: Math.hypot(s.x - from.x, s.y - from.y) }))
        .sort((a, b) => a.d - b.d)[0]?.s;

      if (nearest) {
        const onward = findShortestRoute(stops, bothWays, nearest.id, to.id);
        if (onward.found) {
          return zh
            ? `${from.chineseName} 没有公交停靠。请步行到最近的站点 ${nearest.chineseName}，再乘车约 ${onward.totalMinutes} 分钟到达 ${to.chineseName}。`
            : `No bus stops at ${from.englishName}. Walk to the nearest stop, ${nearest.englishName}, then it is about ${onward.totalMinutes} minutes to ${to.englishName}.`;
        }
      }
      return zh
        ? `抱歉，${from.chineseName} 到 ${to.chineseName} 之间暂时没有可用线路。`
        : `Sorry, there is no available route from ${from.englishName} to ${to.englishName}.`;
    }
    const seq = r.path
      .map((id) => {
        const s = stops.find((x) => x.id === id);
        return zh ? s?.chineseName ?? `#${id}` : s?.englishName ?? `#${id}`;
      })
      .join(" → ");
    return zh
      ? `从 ${from.chineseName} 到 ${to.chineseName} 大约需要 ${r.totalMinutes} 分钟。\n路线：${seq}`
      : `${from.englishName} → ${to.englishName} takes about ${r.totalMinutes} minutes.\nRoute: ${seq}`;
  }

  const busiest = [...stops].sort((a, b) => b.passengerCount - a.passengerCount)[0];
  const q = normalize(question);

  // One stop named: usually they are standing at it and want to know when the
  // bus turns up, so answer that instead of demanding a destination.
  //
  // Two exceptions. "Which stop is busiest" often names no stop at all and is
  // handled below. And someone who clearly asked for directions but only named
  // one end ("how do I get to the library") wants the missing end filled in,
  // not an arrival time - so ask them for it, unless they also asked when.
  if (found.length === 1 && !/busiest|crowded|拥挤|最多/.test(q)) {
    const wantsRoute = asksForRoute(q);
    const wantsArrival = asksAboutArrival(q);
    if (wantsRoute && !wantsArrival) {
      const only = found[0];
      const name = zh ? only.chineseName : only.englishName;
      return zh
        ? `你想从哪一站出发去 ${name}？请告诉我出发站，例如“东门到${name}要多久？”。`
        : `Which stop are you starting from to reach ${name}? Tell me both ends, for example "East Gate to ${name}".`;
    }
    if (!/how many stops|多少站/.test(q)) {
      return arrivalAnswer(found[0], stops, routes, lang, now);
    }
  }

  if (/busiest|crowded|拥挤|最多/.test(q) && busiest) {
    return zh
      ? `目前 ${busiest.chineseName} 候车人数最多（${busiest.passengerCount} 人）。`
      : `${busiest.englishName} has the most people waiting right now (${busiest.passengerCount}).`;
  }
  if (/how many stops|多少站|stops/.test(q)) {
    return zh ? `校园共有 ${stops.length} 个站点。` : `There are ${stops.length} stops on campus.`;
  }

  const names = stops
    .slice(0, 6)
    .map((s) => (zh ? s.chineseName : s.englishName))
    .join(", ");
  return zh
    ? `请告诉我出发站和到达站，例如“东门到图书馆要多久？”。站点包括：${names} 等。`
    : `Tell me a start and a destination, for example "How long from East Gate to the Library?". Stops include: ${names}, and more.`;
}

// --- public API -------------------------------------------------------------

/**
 * The next bus at every stop, ready to hand to the model.
 *
 * The serverless function is never sent the bus-line definitions and is kept
 * free of imports from src/, so it cannot work arrivals out for itself. Rather
 * than mirror the timing maths over there - a second copy that would drift and
 * have the assistant quoting times that disagree with the screen - the client
 * computes them from the one shared engine and sends the answers along.
 */
export function arrivalsSnapshot(stops: Stop[], now: number = Date.now()) {
  const models = buildLineModels();
  const elapsed = simElapsedSec(now);
  const out: {
    stopId: number;
    stopName: string;
    lineName: string;
    lineCode: string;
    minutes: number;
  }[] = [];
  for (const s of stops) {
    const next = nextBusForStop(models, s.id, elapsed);
    if (!next) continue;
    out.push({
      stopId: s.id,
      stopName: s.englishName,
      lineName: next.line.name,
      lineCode: next.line.code,
      minutes: minutesLeft(next.eta),
    });
  }
  return out;
}

export async function askAssistant(
  question: string,
  stops: Stop[],
  routes: Route[],
  lang: "en" | "zh"
): Promise<AssistantReply> {
  try {
    const res = await fetch("/.netlify/functions/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question,
        stops,
        routes,
        lang,
        arrivals: arrivalsSnapshot(stops),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.answer) return { text: data.answer, source: "ai" };
    }
  } catch {
    // fall through to the local parser
  }
  return { text: localAnswer(question, stops, routes, lang), source: "local" };
}
