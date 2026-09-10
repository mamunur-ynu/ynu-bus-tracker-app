// "Tell me when my bus is nearly here."
//
// An honest description of what this is, because the word "notification"
// promises more than it delivers here: this fires from the page itself, so it
// reaches you while the app is open - including in a background tab or behind
// another window - and it does NOT reach you once the tab is closed. A real
// push notification needs a server holding a push subscription and a service
// worker waking up to it; this project has neither, and pretending otherwise
// would mean a student misses their bus trusting an alert that never came.
// The UI says so in as many words.

/** How close the bus has to be, in minutes, before we say anything. */
export const DEFAULT_LEAD_MINUTES = 5;

/** Never fire twice for the same stop inside this window. */
export const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

export interface NotifyDecision {
  eta: number | null;
  leadMinutes: number;
  /** True when the app is not the visible tab. */
  pageHidden: boolean;
  permission: NotificationPermission | "unsupported";
  lastFiredAt: number | null;
  now: number;
}

/**
 * Should we raise an alert right now?
 *
 * Every clause here is a rule about not being annoying, which is the whole
 * difficulty with notifications:
 *
 * - Without permission we say nothing, and we never ask for it here; asking
 *   is a deliberate act by the student, in the component.
 * - If the app is the visible tab we say nothing. The countdown is already on
 *   screen, ticking, in a bigger font than any notification - popping up a
 *   toast to repeat it is pure noise.
 * - We fire once and then go quiet for a cooldown. The arrivals clock ticks
 *   twice a second, so without this the same bus would fire hundreds of
 *   alerts on its way in.
 * - An ETA of zero or less means the bus is already there; the alert would
 *   arrive too late to be worth anything.
 */
export function shouldNotify(d: NotifyDecision): boolean {
  if (d.permission !== "granted") return false;
  if (!d.pageHidden) return false;
  if (d.eta === null || !Number.isFinite(d.eta)) return false;
  if (d.eta <= 0 || d.eta > d.leadMinutes) return false;
  if (d.lastFiredAt !== null && d.now - d.lastFiredAt < NOTIFY_COOLDOWN_MS)
    return false;
  return true;
}

/** Whether this browser can show notifications at all. */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Current permission, or "unsupported" where the API is missing entirely. */
export function permissionState(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

/**
 * Ask for permission. Only ever called from a click, because browsers ignore
 * (and some now permanently block) a permission prompt that appears on load.
 */
export async function requestPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** The words the alert actually shows. */
export function alertText(
  stopName: string,
  lineName: string,
  minutes: number,
  lang: "en" | "zh"
): { title: string; body: string } {
  const mins = Math.max(1, Math.ceil(minutes));
  if (lang === "zh") {
    return {
      title: `${lineName} 即将到站`,
      body: `${mins} 分钟后到达 ${stopName}`,
    };
  }
  return {
    title: `${lineName} is nearly here`,
    body: `Arriving at ${stopName} in about ${mins} min`,
  };
}

/**
 * Show the alert. Returns whether it actually went out, so the caller only
 * starts its cooldown when something was really shown.
 */
export function fireNotification(title: string, body: string): boolean {
  if (!notificationsSupported() || Notification.permission !== "granted")
    return false;
  try {
    // `tag` collapses repeats: if one is somehow still on screen, this
    // replaces it rather than stacking a second copy.
    new Notification(title, { body, tag: "ynu-arrival" });
    return true;
  } catch {
    // Some browsers throw here unless the notification comes from a service
    // worker. Failing quietly is right - the in-app fallback still shows.
    return false;
  }
}
