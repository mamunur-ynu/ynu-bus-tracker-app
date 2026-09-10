// Lightweight i18n. A global language store (same pattern as toast) plus a
// dictionary and a useLang() hook. No heavy framework; extensible by adding
// keys to `dict`. Stop names are already bilingual in campusData.
import { useEffect, useState } from "react";

export type Lang = "en" | "zh";

const dict = {
  "header.kicker": {
    en: "Yunnan University · School of Software & AI",
    zh: "云南大学 · 软件与人工智能学院",
  },
  "header.title": {
    en: "YNU Smart Mobility",
    zh: "云南大学智慧出行",
  },
  "header.subtitle": {
    en: "Your Campus. Your Route. Your Journey.",
    zh: "你的校园，你的路线，你的旅程。",
  },
  "tab.dashboard": { en: "Dashboard", zh: "仪表盘" },
  "tab.editor": { en: "Live Editor", zh: "实时编辑器" },
  "tab.map": { en: "3D City", zh: "3D 城市" },
  "tab.ai": { en: "Ask AI", zh: "智能助手" },
  "ai.title": { en: "Campus Assistant", zh: "校园助手" },
  "ai.subtitle": {
    en: "Answers use the live route engine",
    zh: "答案来自实时路径引擎",
  },
  "ai.hello": {
    en: "Ask me anything about getting around campus — I compute real routes with Dijkstra.",
    zh: "校园出行问题都可以问我 —— 我会用 Dijkstra 实时计算路线。",
  },
  "ai.placeholder": {
    en: "e.g. How long from East Gate to the Library?",
    zh: "例如：东门到图书馆要多久？",
  },
  "ai.send": { en: "Send", zh: "发送" },
  "ai.thinking": { en: "Thinking…", zh: "思考中…" },
  "ai.offline": { en: "offline mode", zh: "离线模式" },
  "map.title": { en: "Campus Operations · 3D", zh: "校园运营 · 3D" },
  "map.subtitle": { en: "Drag to orbit · live buses", zh: "拖动旋转 · 实时公交" },
  "section.overview": { en: "Overview", zh: "概览" },
  "section.routes": { en: "Routes", zh: "路线" },
  "section.capacity": { en: "Capacity", zh: "运力" },
  "section.data": { en: "Data", zh: "数据" },
  "footer.built": {
    en: "Built with React, TypeScript, Vite & Supabase · Yunnan University",
    zh: "使用 React、TypeScript、Vite 和 Supabase 构建 · 云南大学",
  },
  "stat.stops": { en: "Stops", zh: "站点" },
  "stat.routes": { en: "Routes", zh: "路线" },
  "stat.buses": { en: "Buses", zh: "车辆" },
  "stat.schedules": { en: "Schedules", zh: "班次" },
  "stat.peak": { en: "Peak Trips", zh: "高峰班次" },
  "stat.waiting": { en: "Waiting", zh: "候车" },
  "stat.stops.hint": { en: "Campus nodes", zh: "校园节点" },
  "stat.routes.hint": { en: "Directed edges", zh: "有向边" },
  "stat.buses.hint": { en: "Active fleet", zh: "运营车队" },
  "stat.schedules.hint": { en: "Daily trips", zh: "每日班次" },
  "stat.peak.hint": { en: "In peak windows", zh: "高峰时段" },
  "stat.waiting.hint": { en: "Passengers in queues", zh: "排队乘客" },
  "live.title": { en: "Live Arrivals", zh: "实时到站" },
  "live.subtitle": { en: "Simulated real-time", zh: "模拟实时" },
  "live.arriving": { en: "arriving in", zh: "到站还有" },
  "live.now": { en: "arriving now", zh: "即将到站" },
  "live.next": { en: "Next bus", zh: "下一班车" },
  "tab.home": { en: "Home", zh: "首页" },
  "home.morning": { en: "Good morning", zh: "早上好" },
  "home.afternoon": { en: "Good afternoon", zh: "下午好" },
  "home.evening": { en: "Good evening", zh: "晚上好" },
  "home.welcome": {
    en: "Here's your next ride across campus.",
    zh: "这是你下一班校园班车。",
  },
  "home.nextbus": { en: "Next bus", zh: "下一班车" },
  "home.arriving": { en: "Arriving at", zh: "到达" },
  "home.track": { en: "Track live bus", zh: "查看实时位置" },
  "home.nobus": {
    en: "No bus line serves this stop yet.",
    zh: "暂无线路经过该站点。",
  },
  "home.min": { en: "min", zh: "分钟" },
  "home.capacity": { en: "Capacity", zh: "载客量" },
  "home.capacity.low": { en: "Seats free", zh: "座位充足" },
  "home.capacity.medium": { en: "Filling up", zh: "较为拥挤" },
  "home.capacity.high": { en: "Nearly full", zh: "接近满载" },
  "home.favourites": { en: "Your favourite stops", zh: "我的常用站点" },
  "home.favourites.empty": {
    en: "Tap the star on any stop in the trip planner to pin it here.",
    zh: "在路线规划中点击星标，即可固定到这里。",
  },
  "home.busiest": { en: "Busiest stops right now", zh: "当前最繁忙站点" },
  "home.waiting": { en: "waiting", zh: "人候车" },
  "home.quiet": { en: "All stops are quiet right now.", zh: "当前各站点均不拥挤。" },
  "fleet.title": { en: "Fleet management", zh: "车队管理" },
  "fleet.subtitle": { en: "Buses in service", zh: "在运车辆" },
  "fleet.total": { en: "Total buses", zh: "车辆总数" },
  "fleet.active": { en: "In service", zh: "运营中" },
  "fleet.offroad": { en: "Off road", zh: "停运" },
  "fleet.occupancy": { en: "Occupancy", zh: "满载率" },
  "fleet.readonly": {
    en: "Sign in as admin in the panel above to add or edit buses.",
    zh: "请在上方面板以管理员身份登录后添加或编辑车辆。",
  },
  "fleet.plate": { en: "Plate number", zh: "车牌号" },
  "fleet.driver": { en: "Driver", zh: "司机" },
  "fleet.line": { en: "Line", zh: "线路" },
  "fleet.capacity": { en: "Seats", zh: "座位数" },
  "fleet.onboard": { en: "On board", zh: "在车人数" },
  "fleet.add": { en: "Add bus", zh: "添加车辆" },
  "fleet.remove": { en: "Remove", zh: "移除" },
  "fleet.instatus": { en: "In service", zh: "运营中" },
  "fleet.outstatus": { en: "Off road", zh: "停运" },
  "fleet.empty": { en: "No buses in the fleet yet.", zh: "车队暂无车辆。" },
  "fleet.nodriver": { en: "No driver assigned", zh: "未分配司机" },
} as const;

export type I18nKey = keyof typeof dict;

let lang: Lang =
  (typeof localStorage !== "undefined" &&
    (localStorage.getItem("lang") as Lang)) ||
  "en";

// Apply the remembered language to <html lang> on first load.
if (typeof document !== "undefined") {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
}

type Listener = (l: Lang) => void;
const listeners = new Set<Listener>();

export function getLang(): Lang {
  return lang;
}

export function setLang(l: Lang) {
  lang = l;
  try {
    localStorage.setItem("lang", l);
  } catch {
    /* ignore */
  }
  // Keep <html lang> in sync so screen readers and search engines use the
  // right language and pronunciation.
  if (typeof document !== "undefined") {
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  }
  for (const fn of listeners) fn(l);
}

export function t(key: I18nKey): string {
  return dict[key][lang];
}

// React hook: re-renders the component when the language changes.
export function useLang() {
  const [current, setCurrent] = useState<Lang>(lang);
  useEffect(() => {
    const fn: Listener = (l) => setCurrent(l);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return {
    lang: current,
    setLang,
    t: (key: I18nKey) => dict[key][current],
  };
}
