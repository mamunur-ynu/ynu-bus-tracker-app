// Serverless AI assistant.
//
// The browser never sees the model API key: it lives only in the Netlify
// environment. This function runs a small tool-calling agent loop — the model
// can call `find_route`, which executes the same Dijkstra search the app uses,
// and then answers in the user's language.
//
// Providers, in order of preference:
//   AI_API_KEY         → any OpenAI-compatible endpoint (Zhipu GLM, Qwen,
//                        Groq, DeepSeek, OpenAI…). Set AI_BASE_URL + AI_MODEL.
//   GEMINI_API_KEY     → Google Gemini
//   ANTHROPIC_API_KEY  → Claude
// If none is set the function reports `unavailable` and the client falls back
// to its local rule-based parser.

// Kept self-contained on purpose: serverless bundlers resolve imports from
// outside the functions directory inconsistently, so the graph search is
// inlined here rather than imported from src/.

interface Stop {
  id: number;
  englishName: string;
  chineseName: string;
  passengerCount: number;
}

interface Route {
  id: number;
  sourceStopId: number;
  destinationStopId: number;
  travelTimeMinutes: number;
  delayMinutes: number;
}

interface ShortestRouteResult {
  found: boolean;
  path: number[];
  totalMinutes: number;
}

// Dijkstra shortest path — mirrors src/algorithms/dijkstra.ts.
function findShortestRoute(
  stops: Stop[],
  routes: Route[],
  sourceStopId: number,
  destinationStopId: number
): ShortestRouteResult {
  const empty: ShortestRouteResult = { found: false, path: [], totalMinutes: 0 };
  const INF = Number.POSITIVE_INFINITY;
  if (
    !stops.some((s) => s.id === sourceStopId) ||
    !stops.some((s) => s.id === destinationStopId)
  ) {
    return empty;
  }

  const distance = new Map<number, number>();
  const visited = new Map<number, boolean>();
  const previous = new Map<number, number>();
  for (const s of stops) {
    distance.set(s.id, INF);
    visited.set(s.id, false);
  }
  distance.set(sourceStopId, 0);

  for (let step = 0; step < stops.length; step++) {
    let current = -1;
    let best = INF;
    for (const s of stops) {
      const d = distance.get(s.id) ?? INF;
      if (!visited.get(s.id) && d < best) {
        best = d;
        current = s.id;
      }
    }
    if (current === -1) break;
    visited.set(current, true);

    for (const r of routes) {
      if (r.sourceStopId !== current) continue;
      const weight = r.travelTimeMinutes + r.delayMinutes;
      const next = (distance.get(current) ?? INF) + weight;
      if (next < (distance.get(r.destinationStopId) ?? INF)) {
        distance.set(r.destinationStopId, next);
        previous.set(r.destinationStopId, current);
      }
    }
  }

  const total = distance.get(destinationStopId) ?? INF;
  if (total === INF) return empty;

  const path: number[] = [];
  let walk = destinationStopId;
  while (walk !== sourceStopId) {
    path.push(walk);
    const prev = previous.get(walk);
    if (prev === undefined) break;
    walk = prev;
  }
  path.push(sourceStopId);
  path.reverse();
  return { found: true, path, totalMinutes: total };
}

const GEMINI_MODEL = "gemini-2.5-flash";
const CLAUDE_MODEL = "claude-sonnet-5";
const MAX_TURNS = 4;

interface Body {
  question: string;
  stops: Stop[];
  routes: Route[];
  lang?: "en" | "zh";
}

const TOOL_NAME = "find_route";
const TOOL_DESC =
  "Find the shortest bus route between two campus stops using Dijkstra's algorithm. Returns the ordered stops and total travel time in minutes.";
const TOOL_PARAMS = {
  type: "object" as const,
  properties: {
    from_stop_id: { type: "number", description: "id of the starting stop" },
    to_stop_id: { type: "number", description: "id of the destination stop" },
  },
  required: ["from_stop_id", "to_stop_id"],
};

function systemPrompt(stops: Stop[], lang: string) {
  const list = stops
    .map(
      (s) =>
        `${s.id}: ${s.englishName} (${s.chineseName}), ${s.passengerCount} waiting`
    )
    .join("\n");
  return `You are the assistant for the Yunnan University Smart Campus Bus Tracker.

Campus stops (id: English (Chinese), waiting passengers):
${list}

Rules:
- To answer any travel or "how long" question you MUST call the ${TOOL_NAME} tool. Never guess travel times.
- Match stop names loosely (English or Chinese, partial names are fine) and map them to stop ids.
- Reply in the same language the user wrote in. If unsure, use ${lang}.
- Be brief and friendly: give the total minutes and the stop sequence.
- If a stop cannot be identified, list some available stops.`;
}

// Run the tool and return a compact JSON result for the model.
function runTool(
  args: { from_stop_id: number; to_stop_id: number },
  stops: Stop[],
  routes: Route[]
) {
  // Edges are stored one-way, but a shuttle running A→B also returns B→A.
  const bothWays: Route[] = [
    ...routes,
    ...routes.map((rt) => ({
      ...rt,
      id: rt.id + 10000,
      sourceStopId: rt.destinationStopId,
      destinationStopId: rt.sourceStopId,
    })),
  ];
  const r = findShortestRoute(stops, bothWays, args.from_stop_id, args.to_stop_id);
  return {
    found: r.found,
    total_minutes: r.totalMinutes,
    stops_in_order: r.path.map((id) => {
      const s = stops.find((x) => x.id === id);
      return s ? `${s.englishName} (${s.chineseName})` : `#${id}`;
    }),
  };
}

// ------------------------------------------------------ OpenAI-compatible ---
// Works with Zhipu GLM, Qwen (DashScope), Groq, DeepSeek, OpenAI — anything
// exposing /chat/completions with tool calling.

async function askOpenAICompatible(
  key: string,
  baseUrl: string,
  model: string,
  body: Body
): Promise<string> {
  const { question, stops, routes, lang = "en" } = body;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const messages: unknown[] = [
    { role: "system", content: systemPrompt(stops, lang) },
    { role: "user", content: question },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: TOOL_NAME,
              description: TOOL_DESC,
              parameters: TOOL_PARAMS,
            },
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Model ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];

    if (calls.length === 0) {
      return (msg?.content ?? "").trim();
    }

    messages.push(msg);
    for (const call of calls) {
      let args = { from_stop_id: 0, to_stop_id: 0 };
      try {
        args = JSON.parse(call.function?.arguments ?? "{}");
      } catch {
        /* keep defaults */
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(runTool(args, stops, routes)),
      });
    }
  }
  return "That took too many steps — please rephrase.";
}

// ---------------------------------------------------------------- Gemini ----

async function askGemini(key: string, body: Body): Promise<string> {
  const { question, stops, routes, lang = "en" } = body;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const contents: unknown[] = [{ role: "user", parts: [{ text: question }] }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt(stops, lang) }] },
        contents,
        tools: [
          {
            function_declarations: [
              { name: TOOL_NAME, description: TOOL_DESC, parameters: TOOL_PARAMS },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const parts: Array<Record<string, unknown>> =
      data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);

    if (calls.length === 0) {
      return parts
        .map((p) => (p.text as string) ?? "")
        .join("\n")
        .trim();
    }

    contents.push({ role: "model", parts });
    contents.push({
      role: "user",
      parts: calls.map((p) => {
        const fc = p.functionCall as { name: string; args: Record<string, number> };
        return {
          functionResponse: {
            name: fc.name,
            response: runTool(
              {
                from_stop_id: fc.args.from_stop_id,
                to_stop_id: fc.args.to_stop_id,
              },
              stops,
              routes
            ),
          },
        };
      }),
    });
  }
  return "That took too many steps — please rephrase.";
}

// ---------------------------------------------------------------- Claude ----

async function askClaude(key: string, body: Body): Promise<string> {
  const { question, stops, routes, lang = "en" } = body;
  const messages: unknown[] = [{ role: "user", content: question }];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        system: systemPrompt(stops, lang),
        tools: [
          { name: TOOL_NAME, description: TOOL_DESC, input_schema: TOOL_PARAMS },
        ],
        messages,
      }),
    });

    if (!res.ok) {
      throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const data = await res.json();
    const blocks: Array<Record<string, unknown>> = data.content ?? [];

    if (data.stop_reason !== "tool_use") {
      return blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("\n")
        .trim();
    }

    messages.push({ role: "assistant", content: blocks });
    messages.push({
      role: "user",
      content: blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({
          type: "tool_result",
          tool_use_id: b.id,
          content: JSON.stringify(
            runTool(b.input as { from_stop_id: number; to_stop_id: number }, stops, routes)
          ),
        })),
    });
  }
  return "That took too many steps — please rephrase.";
}

// ----------------------------------------------------------------- handler --

export default async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const generic = process.env.AI_API_KEY;
  const baseUrl =
    process.env.AI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
  const model = process.env.AI_MODEL ?? "glm-4-flash";
  const gemini = process.env.GEMINI_API_KEY;
  const claude = process.env.ANTHROPIC_API_KEY;
  if (!generic && !gemini && !claude) return Response.json({ unavailable: true });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.question || !Array.isArray(body.stops) || !Array.isArray(body.routes)) {
    return Response.json({ error: "Missing question, stops or routes" }, { status: 400 });
  }

  try {
    const answer = generic
      ? await askOpenAICompatible(generic, baseUrl, model, body)
      : gemini
        ? await askGemini(gemini, body)
        : await askClaude(claude as string, body);
    return Response.json({ answer: answer || "Sorry, I could not answer that." });
  } catch (e) {
    return Response.json(
      { error: "Assistant failed", detail: String(e).slice(0, 300) },
      { status: 502 }
    );
  }
};
