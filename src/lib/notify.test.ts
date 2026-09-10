import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_LEAD_MINUTES,
  NOTIFY_COOLDOWN_MS,
  alertText,
  fireNotification,
  notificationsSupported,
  permissionState,
  requestPermission,
  shouldNotify,
  type NotifyDecision,
} from "./notify";

// Notifications are the easiest feature in an app to make hateful, so almost
// every test here is about staying quiet: not firing when the student is
// already looking at the countdown, not firing hundreds of times as the clock
// ticks down, and never firing without permission.

const NOW = 1_800_000_000_000;

const decision = (over: Partial<NotifyDecision> = {}): NotifyDecision => ({
  eta: 3,
  leadMinutes: DEFAULT_LEAD_MINUTES,
  pageHidden: true,
  permission: "granted",
  lastFiredAt: null,
  now: NOW,
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shouldNotify", () => {
  it("fires when the bus is close and the student is looking elsewhere", () => {
    expect(shouldNotify(decision())).toBe(true);
  });

  it("says nothing without permission", () => {
    expect(shouldNotify(decision({ permission: "default" }))).toBe(false);
    expect(shouldNotify(decision({ permission: "denied" }))).toBe(false);
    expect(shouldNotify(decision({ permission: "unsupported" }))).toBe(false);
  });

  it("says nothing while the app is the visible tab", () => {
    // The countdown is already on screen in a far bigger font than any
    // notification. Repeating it is pure noise.
    expect(shouldNotify(decision({ pageHidden: false }))).toBe(false);
  });

  it("stays quiet while the bus is still far off", () => {
    expect(shouldNotify(decision({ eta: 12 }))).toBe(false);
  });

  it("fires exactly at the lead time", () => {
    expect(shouldNotify(decision({ eta: 5, leadMinutes: 5 }))).toBe(true);
  });

  it("does not fire once the bus has already arrived", () => {
    // An alert that lands as the doors close is worse than none.
    expect(shouldNotify(decision({ eta: 0 }))).toBe(false);
    expect(shouldNotify(decision({ eta: -2 }))).toBe(false);
  });

  it("copes with no bus at all", () => {
    expect(shouldNotify(decision({ eta: null }))).toBe(false);
    expect(shouldNotify(decision({ eta: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(shouldNotify(decision({ eta: Number.NaN }))).toBe(false);
  });

  it("holds its tongue during the cooldown", () => {
    // The arrivals clock ticks twice a second; without this the same bus
    // would fire hundreds of alerts on its way in.
    expect(
      shouldNotify(decision({ lastFiredAt: NOW - NOTIFY_COOLDOWN_MS + 1000 }))
    ).toBe(false);
  });

  it("speaks again once the cooldown has passed", () => {
    expect(
      shouldNotify(decision({ lastFiredAt: NOW - NOTIFY_COOLDOWN_MS - 1 }))
    ).toBe(true);
  });

  it("only fires once across a whole approach", () => {
    // Walk a bus in from 6 minutes to 1, ticking every half second like the
    // real screen does, and count how many alerts a student would receive.
    let lastFiredAt: number | null = null;
    let fired = 0;
    for (let step = 0; step < 600; step++) {
      const now = NOW + step * 500;
      const eta = 6 - step * 0.01;
      if (
        shouldNotify(decision({ eta, now, lastFiredAt, leadMinutes: 5 }))
      ) {
        fired += 1;
        lastFiredAt = now;
      }
    }
    expect(fired).toBe(1);
  });
});

describe("alertText", () => {
  it("rounds up so it never under-promises", () => {
    expect(alertText("YNU Library", "Z52", 2.4, "en").body).toMatch(/3 min/);
  });

  it("never says zero minutes", () => {
    expect(alertText("YNU Library", "Z52", 0.1, "en").body).toMatch(/1 min/);
  });

  it("names the stop and the line", () => {
    const { title, body } = alertText("YNU Library", "Z52", 3, "en");
    expect(title).toContain("Z52");
    expect(body).toContain("YNU Library");
  });

  it("writes Chinese when the app is in Chinese", () => {
    const { title, body } = alertText("图书馆", "Z52", 3, "zh");
    expect(title).toContain("到站");
    expect(body).toContain("图书馆");
    expect(body).toContain("分钟");
  });
});

describe("browser support", () => {
  it("reports unsupported when the API is missing", () => {
    vi.stubGlobal("window", {});
    expect(notificationsSupported()).toBe(false);
    expect(permissionState()).toBe("unsupported");
  });

  it("reads the current permission when supported", () => {
    vi.stubGlobal("window", { Notification: { permission: "granted" } });
    vi.stubGlobal("Notification", { permission: "granted" });
    expect(permissionState()).toBe("granted");
  });

  it("returns unsupported rather than throwing when asked to prompt", async () => {
    vi.stubGlobal("window", {});
    await expect(requestPermission()).resolves.toBe("unsupported");
  });

  it("treats a thrown permission request as a refusal", async () => {
    const boom = () => {
      throw new Error("not allowed");
    };
    vi.stubGlobal("window", { Notification: { requestPermission: boom } });
    vi.stubGlobal("Notification", { requestPermission: boom, permission: "default" });
    await expect(requestPermission()).resolves.toBe("denied");
  });
});

describe("fireNotification", () => {
  it("does nothing without permission", () => {
    const ctor = vi.fn();
    vi.stubGlobal("window", { Notification: ctor });
    vi.stubGlobal("Notification", Object.assign(ctor, { permission: "default" }));
    expect(fireNotification("t", "b")).toBe(false);
    expect(ctor).not.toHaveBeenCalled();
  });

  it("shows the notification when allowed", () => {
    const ctor = vi.fn();
    vi.stubGlobal("window", { Notification: ctor });
    vi.stubGlobal("Notification", Object.assign(ctor, { permission: "granted" }));
    expect(fireNotification("Bus is close", "2 min")).toBe(true);
    expect(ctor).toHaveBeenCalledWith(
      "Bus is close",
      expect.objectContaining({ body: "2 min", tag: "ynu-arrival" })
    );
  });

  it("reports failure instead of throwing when the browser refuses", () => {
    // Some browsers only allow notifications from a service worker and throw
    // on the constructor. That must not take the page down.
    const ctor = vi.fn(() => {
      throw new TypeError("Illegal constructor");
    });
    vi.stubGlobal("window", { Notification: ctor });
    vi.stubGlobal("Notification", Object.assign(ctor, { permission: "granted" }));
    expect(fireNotification("t", "b")).toBe(false);
  });
});
