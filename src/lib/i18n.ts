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
    en: "Smart Campus Bus Tracker",
    zh: "智慧校园公交追踪系统",
  },
  "header.subtitle": {
    en: "A live, cloud-based route optimizer for the campus shuttle network.",
    zh: "面向校园班车网络的实时云端路径优化系统。",
  },
  "tab.dashboard": { en: "Dashboard", zh: "仪表盘" },
  "tab.editor": { en: "Live Editor", zh: "实时编辑器" },
  "tab.map": { en: "3D City", zh: "3D 城市" },
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
} as const;

export type I18nKey = keyof typeof dict;

let lang: Lang =
  (typeof localStorage !== "undefined" &&
    (localStorage.getItem("lang") as Lang)) ||
  "en";

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
