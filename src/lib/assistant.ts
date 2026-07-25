// Client side of the AI assistant.
//
// It first tries the serverless function (real LLM with tool calling). If no
// model key is configured, or the network call fails, it degrades gracefully
// to a local rule-based parser so the feature always answers something useful.

import { findShortestRoute } from "../algorithms/dijkstra";
import type { Stop, Route } from "../data/campusData";

export interface AssistantReply {
  text: string;
  source: "ai" | "local";
}

// --- local fallback ---------------------------------------------------------

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, " ").trim();
}

// Names people actually type: the full name plus common short forms, so
// "East Gate" matches "YNU East Gate" and "东门" matches "云南大学东门".
function aliases(s: Stop): string[] {
  const out = [s.englishName, s.chineseName];
  out.push(s.englishName.replace(/^YNU\s+/i, ""));
  out.push(s.chineseName.replace(/^云南大学/, ""));
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

function localAnswer(
  question: string,
  stops: Stop[],
  routes: Route[],
  lang: "en" | "zh"
): string {
  const zh = lang === "zh";
  const found = matchStops(question, stops);

  if (found.length >= 2) {
    const [from, to] = found;
    const r = findShortestRoute(stops, routes, from.id, to.id);
    if (!r.found) {
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
      body: JSON.stringify({ question, stops, routes, lang }),
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
