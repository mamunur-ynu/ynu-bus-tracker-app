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
  latitude?: number | null;
  longitude?: number | null;
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
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
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
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
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

// ---- Driver emergency alerts ----
// The one table with an asymmetric policy: an anonymous driver console may
// INSERT (raise an alert) but may not SELECT, so the table can never be read
// back by a stranger to trace where buses and drivers are. Only a signed-in
// admin can list or clear them.
export interface DriverAlert {
  id?: number;
  busId: number | null;
  plateNumber: string;
  driverName?: string;
  line?: string;
  nearStop?: string;
  note?: string;
  raisedAt?: string;
}

// DO NOT chain .select() onto this insert.
//
// A driver is anonymous, and this table deliberately grants anon INSERT but
// not SELECT. supabase-js sends `Prefer: return=minimal` when you don't ask
// for the row back, which the database accepts (201). Adding .select() flips
// it to `return=representation`, which asks to read the row straight back -
// and that is refused with 401 for an anonymous caller. I checked both shapes
// against the real API rather than assuming. The trap is that it would still
// work perfectly while testing signed in as admin, and fail only for the
// actual drivers, which is the one case that matters here.
export async function cloudRaiseAlert(a: DriverAlert): Promise<string | null> {
  const { error } = await db().from("driver_alerts").insert({
    bus_id: a.busId,
    plate_number: a.plateNumber,
    driver_name: a.driverName ?? null,
    line: a.line ?? null,
    near_stop: a.nearStop ?? null,
    note: a.note ?? null,
  });
  return error ? error.message : null;
}

/** Admin only: an anonymous caller gets a permission error, by design. */
export async function cloudFetchAlerts(): Promise<DriverAlert[]> {
  const { data, error } = await db()
    .from("driver_alerts")
    .select("*")
    .order("raised_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as number,
    busId: (r.bus_id as number) ?? null,
    plateNumber: r.plate_number as string,
    driverName: (r.driver_name as string) ?? undefined,
    line: (r.line as string) ?? undefined,
    nearStop: (r.near_stop as string) ?? undefined,
    note: (r.note as string) ?? undefined,
    raisedAt: r.raised_at as string,
  }));
}

export async function cloudClearAlert(id: number): Promise<string | null> {
  const { error } = await db().from("driver_alerts").delete().eq("id", id);
  return error ? error.message : null;
}

// ---- Live GPS positions (the `bus_locations` table) ----
//
// Security lives in the database, not here: everyone may read, but the RLS
// policy only lets a signed-in driver write the row for the bus they are
// actually assigned to in the `drivers` table. A stranger cannot place a bus
// on the map, and one driver cannot move another driver's bus.
export interface BusLocation {
  busId: number;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  heading: number | null;
  accuracyM: number | null;
  status: string;
  updatedAt: string;
}

function rowToLocation(r: Record<string, unknown>): BusLocation {
  return {
    busId: r.bus_id as number,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    speedKmh: (r.speed_kmh as number) ?? null,
    heading: (r.heading as number) ?? null,
    accuracyM: (r.accuracy_m as number) ?? null,
    status: (r.status as string) ?? "active",
    updatedAt: r.updated_at as string,
  };
}

export async function cloudFetchBusLocations(): Promise<BusLocation[]> {
  const { data, error } = await db().from("bus_locations").select("*");
  if (error) throw new Error(`Reading bus locations failed: ${error.message}`);
  return (data as Record<string, unknown>[]).map(rowToLocation);
}

/** Which bus this signed-in account is allowed to drive, if any. */
export async function cloudMyDriverBus(): Promise<number | null> {
  const { data, error } = await db()
    .from("drivers")
    .select("bus_id")
    .maybeSingle();
  if (error) return null;
  return (data?.bus_id as number) ?? null;
}

/** Publish one GPS fix. Rejected by the database unless it is your own bus. */
export async function cloudPublishLocation(
  loc: Omit<BusLocation, "updatedAt" | "status"> & { status?: string }
): Promise<string | null> {
  const { error } = await db().from("bus_locations").upsert(
    {
      bus_id: loc.busId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed_kmh: loc.speedKmh,
      heading: loc.heading,
      accuracy_m: loc.accuracyM,
      status: loc.status ?? "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bus_id" }
  );
  return error ? error.message : null;
}

/**
 * Live position updates. Falls back to polling in the caller if the socket
 * never connects - the same three-layer approach the rest of the app uses,
 * because a WebSocket to a service hosted abroad is exactly what an unreliable
 * campus network drops first.
 */
export function subscribeToBusLocations(
  onChange: (loc: BusLocation) => void,
  onStatus?: (status: RealtimeStatus) => void
): () => void {
  const channel = db()
    .channel("bus-locations-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bus_locations" },
      (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (row && row.bus_id !== undefined) onChange(rowToLocation(row));
      }
    )
    .subscribe((status) => onStatus?.(status as RealtimeStatus));
  return () => {
    db().removeChannel(channel);
  };
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
