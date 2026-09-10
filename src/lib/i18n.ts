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
  "tab.driver": { en: "Driver", zh: "司机端" },
  "driver.title": { en: "Driver console", zh: "司机控制台" },
  "driver.subtitle": { en: "Live GPS + timetable", zh: "实时 GPS + 时刻表" },
  "driver.pick": { en: "Select your bus", zh: "选择你的车辆" },
  "driver.nobus": { en: "No buses in the fleet.", zh: "车队暂无车辆。" },
  "driver.start": { en: "Start trip", zh: "开始行程" },
  "driver.end": { en: "End trip", zh: "结束行程" },
  "driver.onshift": { en: "On trip", zh: "行驶中" },
  "driver.offshift": { en: "Not started", zh: "未开始" },
  "driver.nextstop": { en: "Next stop", zh: "下一站" },
  "driver.progress": { en: "Trip progress", zh: "行程进度" },
  "driver.elapsed": { en: "Elapsed", zh: "已用时" },
  "driver.arrived": { en: "Trip complete", zh: "行程结束" },
  "driver.boarding": { en: "Passengers on board", zh: "在车人数" },
  "driver.savedcloud": { en: "Saved to the cloud", zh: "已保存到云端" },
  "driver.localonly": {
    en: "Kept on this device only — sign in as admin to save the count.",
    zh: "仅保存在本机 —— 需管理员登录后才能保存人数。",
  },
  "driver.emergency": { en: "Emergency alert", zh: "紧急报警" },
  "driver.emergency.hint": {
    en: "Sends your bus, line and nearest stop to the campus admin.",
    zh: "将车辆、线路和最近站点发送给校方管理员。",
  },
  "driver.emergency.sent": { en: "Alert sent to campus admin", zh: "已向管理员发送警报" },
  "driver.emergency.failed": {
    en: "Alert could NOT be sent — no connection. Call campus security directly.",
    zh: "警报发送失败 —— 无网络连接。请直接致电校园保卫处。",
  },
  "driver.simnote": {
    en: "Trip progress above is modelled from the timetable. The position shared on the live map is your phone's real GPS.",
    zh: "上方行程进度基于时刻表推算；实时地图上共享的是手机真实 GPS 位置。",
  },
  "alerts.title": { en: "Emergency alerts", zh: "紧急警报" },
  "alerts.none": { en: "No open alerts.", zh: "暂无警报。" },
  "alerts.clear": { en: "Clear", zh: "清除" },
  "tab.live": { en: "Live Map", zh: "实时地图" },
  "gps.title": { en: "Live GPS", zh: "实时定位" },
  "gps.signin": { en: "Sign in to broadcast", zh: "登录后开始广播" },
  "gps.signin.hint": {
    en: "Drivers sign in with the account the university issued. Only the bus assigned to that account can be moved on the map.",
    zh: "司机使用学校发放的账号登录。仅能更新该账号所绑定的车辆位置。",
  },
  "gps.notdriver": {
    en: "This account has no bus assigned, so it cannot broadcast a position.",
    zh: "该账号未绑定车辆，无法广播位置。",
  },
  "gps.assigned": { en: "Assigned bus", zh: "绑定车辆" },
  "gps.broadcasting": { en: "Broadcasting live GPS", zh: "正在广播实时定位" },
  "gps.requesting": { en: "Getting a GPS fix…", zh: "正在获取定位…" },
  "gps.denied": {
    en: "Location permission was refused. Allow location for this site, then start the trip again.",
    zh: "定位权限被拒绝。请允许本站访问位置后重新开始行程。",
  },
  "gps.unavailable": {
    en: "No GPS signal. Move somewhere with a clearer view of the sky.",
    zh: "无 GPS 信号。请移动到视野开阔的位置。",
  },
  "gps.error": { en: "Could not read the GPS.", zh: "无法读取 GPS。" },
  "gps.sendfailed": {
    en: "Position not saved — the server refused it.",
    zh: "位置未保存 —— 服务器拒绝。",
  },
  "gps.accuracy": { en: "Accuracy", zh: "精度" },
  "gps.speed": { en: "Speed", zh: "速度" },
  "gps.lastsent": { en: "Last sent", zh: "最近上传" },
  "gps.acc.high": { en: "High accuracy", zh: "高精度" },
  "gps.acc.medium": { en: "Medium accuracy", zh: "中等精度" },
  "gps.acc.low": { en: "Low accuracy", zh: "低精度" },
  "gps.acc.unknown": { en: "Accuracy unknown", zh: "精度未知" },
  "live.map.title": { en: "Live bus map", zh: "实时公交地图" },
  "live.map.subtitle": { en: "Real GPS positions", zh: "真实 GPS 位置" },
  "live.none": {
    en: "No bus is broadcasting a position right now.",
    zh: "当前没有车辆在广播位置。",
  },
  "live.none.hint": {
    en: "A bus appears here as soon as its driver signs in and starts a trip.",
    zh: "司机登录并开始行程后，车辆会立即出现在这里。",
  },
  "live.realtime": { en: "Realtime", zh: "实时" },
  "live.polling": { en: "Refreshing every 5s", zh: "每 5 秒刷新" },
  "live.locating": { en: "Show my location", zh: "显示我的位置" },
  "live.stale": { en: "Position may be out of date", zh: "位置可能已过时" },
  "live.lost": { en: "Location unavailable", zh: "位置不可用" },
  "live.lastseen": { en: "Last seen", zh: "最后更新" },
  "live.secondsago": { en: "s ago", zh: " 秒前" },
  "live.minutesago": { en: "min ago", zh: " 分钟前" },
  "live.nextstop": { en: "Next stop", zh: "下一站" },
  "live.away": { en: "away", zh: "距离" },
  "live.nocoords": {
    en: "Stops have no real coordinates yet, so distances are not shown.",
    zh: "站点尚未录入真实坐标，暂不显示距离。",
  },
  "cal.title": { en: "Stop GPS coordinates", zh: "站点 GPS 坐标" },
  "cal.hint": {
    en: "Stand at the stop and press Capture. The phone's own GPS is recorded — nothing is estimated from the map picture.",
    zh: "站在该站点按“采集”。将记录手机 GPS 实际坐标 —— 不会从地图图片推算。",
  },
  "cal.capture": { en: "Capture here", zh: "采集此处" },
  "cal.captured": { en: "Captured", zh: "已采集" },
  "cal.missing": { en: "Not captured yet", zh: "尚未采集" },
  "cal.saved": { en: "Coordinates saved", zh: "坐标已保存" },
  "cal.progress": { en: "stops captured", zh: "个站点已采集" },
  "cal.adminonly": {
    en: "Sign in as admin to capture stop coordinates.",
    zh: "请以管理员身份登录后采集站点坐标。",
  },
  "live.tilesfailed": {
    en: "The map background could not load, but the bus positions below are still live.",
    zh: "地图底图加载失败，但下方车辆位置仍为实时数据。",
  },
  "live.tiles": {
    en: "Map data © OpenStreetMap contributors",
    zh: "地图数据 © OpenStreetMap 贡献者",
  },
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
