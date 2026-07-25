// Serverless AI assistant.
//
// The browser never sees the model API key: the key lives only in the Netlify
// environment (ANTHROPIC_API_KEY). This function runs a small tool-calling
// agent loop — the model can call `find_route`, which executes the same
// Dijkstra search the app uses, and then answers in the user's language.

import { findShortestRoute } from "../../src/algorithms/dijkstra";
import type { Stop, Route } from "../../src/data/campusData";

const MODEL = "claude-sonnet-5";
const MAX_TURNS = 4;

interface Body {
  question: string;
  stops: Stop[];
  routes: Route[];
  lang?: "en" | "zh";
}

const tools = [
  {
    name: "find_route",
    description:
      "Find the shortest bus route between two campus stops using Dijkstra's algorithm. Returns the ordered list of stops and the total travel time in minutes.",
    input_schema: {
      type: "object" as const,
      properties: {
        from_stop_id: { type: "number", description: "id of the starting stop" },
        to_stop_id: { type: "number", description: "id of the destination stop" },
      },
      required: ["from_stop_id", "to_stop_id"],
    },
  },
];

function systemPrompt(stops: Stop[], lang: string) {
  const list = stops
    .map((s) => `${s.id}: ${s.englishName} (${s.chineseName}), ${s.passengerCount} waiting`)
    .join("\n");
  return `You are the assistant for the Yunnan University Smart Campus Bus Tracker.

Campus stops (id: English (Chinese), waiting passengers):
${list}

Rules:
- To answer any travel or "how long" question, you MUST call the find_route tool. Never guess travel times.
- Match the user's stop names loosely (English or Chinese, partial names are fine) and map them to stop ids.
- Reply in the same language the user wrote in. If the interface language is ${lang}, prefer that when unsure.
- Be brief and friendly: give the total minutes and the stop sequence. Mention waiting passengers only if relevant.
- If a stop cannot be identified, say which stops are available.`;
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured — tell the client to use its local fallback.
    return Response.json({ unavailable: true }, { status: 200 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { question, stops, routes, lang = "en" } = body;
  if (!question || !Array.isArray(stops) || !Array.isArray(routes)) {
    return Response.json({ error: "Missing question, stops or routes" }, { status: 400 });
  }

  const messages: unknown[] = [{ role: "user", content: question }];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 600,
          system: systemPrompt(stops, lang),
          tools,
          messages,
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        return Response.json(
          { error: `Model request failed (${res.status})`, detail: detail.slice(0, 300) },
          { status: 502 }
        );
      }

      const data = await res.json();
      const blocks: Array<Record<string, unknown>> = data.content ?? [];

      if (data.stop_reason !== "tool_use") {
        const text = blocks
          .filter((b) => b.type === "text")
          .map((b) => b.text as string)
          .join("\n")
          .trim();
        return Response.json({ answer: text || "Sorry, I could not answer that." });
      }

      // Run every requested tool call and feed the results back.
      messages.push({ role: "assistant", content: blocks });
      const results = blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => {
          const input = b.input as { from_stop_id: number; to_stop_id: number };
          const r = findShortestRoute(stops, routes, input.from_stop_id, input.to_stop_id);
          const named = r.path.map((id) => {
            const s = stops.find((x) => x.id === id);
            return s ? `${s.englishName} (${s.chineseName})` : `#${id}`;
          });
          return {
            type: "tool_result",
            tool_use_id: b.id,
            content: JSON.stringify({
              found: r.found,
              total_minutes: r.totalMinutes,
              stops_in_order: named,
            }),
          };
        });
      messages.push({ role: "user", content: results });
    }

    return Response.json({ answer: "That took too many steps — please rephrase." });
  } catch (e) {
    return Response.json(
      { error: "Assistant failed", detail: String(e).slice(0, 300) },
      { status: 500 }
    );
  }
};
