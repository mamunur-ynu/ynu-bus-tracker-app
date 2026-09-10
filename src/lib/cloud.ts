// Cloud data layer (Supabase). If the config is empty, the app falls back to
// browser storage, so nothing breaks before the keys are filled in.
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseConfig";
import type { Stop, Route, Bus } from "../data/campusData";

export function isCloudConfigured(): boolean {
  return SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
}

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

// The database uses snake_case columns; the app uses camelCase fields.
interface StopRow {
  id: number;
  english_name: string;
  chinese_name: string | null;
  x: number;
  y: number;
  passenger_count: number | null;
}
interface RouteRow {
  id: number;
  name: string;
  source_stop_id: number;
  destination_stop_id: number;
  travel_time_minutes: number;
  delay_minutes: number | null;
}
interface BusRow {
  id: number;
  plate_number: string;
  line: string;
  capacity: number;
  onboard_count: number;
  driver_name: string | null;
  active: boolean;
}

function rowToStop(r: StopRow): Stop {
  return {
    id: r.id,
    englishName: r.english_name,
    chineseName: r.chinese_name ?? "",
    x: r.x,
    y: r.y,
    passengerCount: r.passenger_count ?? 0,
  };
}
function stopToRow(s: Stop): StopRow {
  return {
    id: s.id,
    english_name: s.englishName,
    chinese_name: s.chineseName,
    x: s.x,
    y: s.y,
    passenger_count: s.passengerCount,
  };
}
function rowToRoute(r: RouteRow): Route {
  return {
    id: r.id,
    name: r.name,
    sourceStopId: r.source_stop_id,
    destinationStopId: r.destination_stop_id,
    travelTimeMinutes: r.travel_time_minutes,
    delayMinutes: r.delay_minutes ?? 0,
  };
}
function routeToRow(r: Route): RouteRow {
  return {
    id: r.id,
    name: r.name,
    source_stop_id: r.sourceStopId,
    destination_stop_id: r.destinationStopId,
    travel_time_minutes: r.travelTimeMinutes,
    delay_minutes: r.delayMinutes,
  };
}

function rowToBus(r: BusRow): Bus {
  return {
    id: r.id,
    plateNumber: r.plate_number,
    line: r.line,
    capacity: r.capacity,
    onboardCount: r.onboard_count,
    driverName: r.driver_name ?? undefined,
    active: r.active,
  };
}
function busToRow(b: Bus): BusRow {
  return {
    id: b.id,
    plate_number: b.plateNumber,
    line: b.line,
    capacity: b.capacity,
    onboard_count: b.onboardCount,
    driver_name: b.driverName ?? null,
    active: b.active,
  };
}

export async function cloudFetch(): Promise<{ stops: Stop[]; routes: Route[] }> {
  const s = await db().from("stops").select("*").order("id");
  const r = await db().from("routes").select("*").order("id");
  // A Supabase query that is REJECTED (most commonly: no Row Level Security
  // policy letting anonymous visitors read that table) still comes back as
  // `{ data: null, error: {...} }`, not a thrown exception. We used to
  // ignore `.error` and fall back to `[]`, which made a rejected query look
  // exactly like "this table is genuinely empty" - and the caller would
  // then happily wipe every stop/route on screen with that empty list.
  // Throwing here instead lets the existing try/catch in LiveEditor keep
  // showing the last good data and tell the user something is wrong.
  if (s.error) throw new Error(`Reading stops failed: ${s.error.message}`);
  if (r.error) throw new Error(`Reading routes failed: ${r.error.message}`);
  const stops = (s.data as StopRow[]).map(rowToStop);
  const routes = (r.data as RouteRow[]).map(rowToRoute);
  return { stops, routes };
}

// These now return an error message (or null on success) so the UI can show it.
export async function cloudUpsertStop(s: Stop): Promise<string | null> {
  const { error } = await db().from("stops").upsert(stopToRow(s));
  return error ? error.message : null;
}
export async function cloudUpsertRoute(r: Route): Promise<string | null> {
  const { error } = await db().from("routes").upsert(routeToRow(r));
  return error ? error.message : null;
}
export async function cloudDeleteStop(id: number): Promise<string | null> {
  const { error } = await db().from("stops").delete().eq("id", id);
  return error ? error.message : null;
}
export async function cloudDeleteRoute(id: number): Promise<string | null> {
  const { error } = await db().from("routes").delete().eq("id", id);
  return error ? error.message : null;
}

// ---- Fleet (the `buses` table) ----
// Same contract as the stop/route helpers above: a failed read throws rather
// than quietly returning [], and a failed write returns the message so the
// admin sees why it did not save.
export async function cloudFetchBuses(): Promise<Bus[]> {
  const { data, error } = await db().from("buses").select("*").order("id");
  if (error) throw new Error(`Reading buses failed: ${error.message}`);
  return (data as BusRow[]).map(rowToBus);
}
export async function cloudUpsertBus(b: Bus): Promise<string | null> {
  const { error } = await db().from("buses").upsert(busToRow(b));
  return error ? error.message : null;
}
export async function cloudDeleteBus(id: number): Promise<string | null> {
  const { error } = await db().from("buses").delete().eq("id", id);
  return error ? error.message : null;
}

export async function cloudSeed(
  stops: Stop[],
  routes: Route[]
): Promise<string | null> {
  const s = await db().from("stops").upsert(stops.map(stopToRow));
  if (s.error) return s.error.message;
  const r = await db().from("routes").upsert(routes.map(routeToRow));
  if (r.error) return r.error.message;
  return null;
}

// ---- Admin authentication (Supabase Auth) ----

export async function signIn(
  email: string,
  password: string
): Promise<string | null> {
  const { error } = await db().auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await db().auth.signOut();
}

export async function currentEmail(): Promise<string | null> {
  const { data } = await db().auth.getUser();
  return data.user?.email ?? null;
}

export function onAuthChange(cb: (email: string | null) => void): () => void {
  const { data } = db().auth.onAuthStateChange((_event, session) => {
    cb(session?.user?.email ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// The four states Supabase's realtime-js library reports back through the
// subscribe() callback. We re-declare the strings here (instead of importing
// the enum) so callers don't need to know about @supabase/supabase-js types.
export type RealtimeStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

// Listen for live changes on the stops and routes tables. The callback runs
// whenever anyone inserts, updates, or deletes a row, so every open screen
// stays in sync. Returns a function to stop listening.
//
// `onStatus` reports whether the realtime WebSocket actually connected. This
// matters because a channel can silently fail to connect (wrong Supabase
// Realtime settings, a network/firewall that blocks WebSocket traffic, a
// paused project, etc.) while normal HTTP calls like cloudFetch keep working
// fine — so the UI must not claim "live" just because *some* cloud call
// succeeded.
export function subscribeToChanges(
  onChange: () => void,
  onStatus?: (status: RealtimeStatus) => void
): () => void {
  const channel = db()
    .channel("campus-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "stops" },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "routes" },
      onChange
    )
    .subscribe((status) => {
      onStatus?.(status as RealtimeStatus);
    });
  return () => {
    db().removeChannel(channel);
  };
}
