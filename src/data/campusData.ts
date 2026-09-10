// Campus data for the visual dashboard.
// The stops and routes are based on the Yunnan University Chenggong campus
// map and the campus bus route-board (lines Z52 and Z53).
// The x and y fields are percentage positions on the campus map image
// (0 to 100), used to place the stop markers on the map overlay.

export interface Stop {
  id: number;
  englishName: string;
  chineseName: string;
  x: number; // percent from left
  y: number; // percent from top
  passengerCount: number;
}

export interface Route {
  id: number;
  name: string;
  sourceStopId: number;
  destinationStopId: number;
  travelTimeMinutes: number;
  delayMinutes: number;
  // A simulation connector is not a real bus-board line. It only exists so
  // the shortest route search can show an alternative path under delay.
  isSimulation?: boolean;
}

export interface Bus {
  id: number;
  plateNumber: string;
  capacity: number;
  onboardCount: number;
  line: string;
}

export interface TimeSlot {
  hour: number;
  minute: number;
}

export interface Schedule {
  id: number;
  line: string;
  busId: number;
  departure: TimeSlot;
  arrival: TimeSlot;
}

export interface BusLine {
  code: string; // official route-board code, for example Z52
  displayName: string; // custom professional name shown in the UI
  label: string;
  color: string;
  stopIds: number[];
}

// Peak-hour windows, same as the C++ constants in Common.h.
export const MORNING_PEAK_START_HOUR = 8;
export const MORNING_PEAK_END_HOUR = 10;
export const AFTERNOON_PEAK_START_HOUR = 16;
export const AFTERNOON_PEAK_END_HOUR = 18;

// The x and y values are tuned to the label positions on the campus map
// image (public/ynu-campus-map.jpg), given as percentages of the image size.
export const stops: Stop[] = [
  { id: 1, englishName: "YNU East Gate", chineseName: "云南大学东门", x: 93, y: 52, passengerCount: 0 },
  { id: 2, englishName: "YNU North Gate", chineseName: "云南大学北门", x: 40, y: 14, passengerCount: 0 },
  { id: 3, englishName: "YNU South Gate", chineseName: "云南大学南门", x: 50, y: 75, passengerCount: 0 },
  { id: 4, englishName: "YNU West Gate", chineseName: "云南大学西门", x: 11, y: 52, passengerCount: 0 },
  { id: 5, englishName: "Zehu Lake", chineseName: "泽湖", x: 26, y: 11, passengerCount: 0 },
  { id: 6, englishName: "YNU Library", chineseName: "图书馆", x: 33, y: 56, passengerCount: 6 },
  { id: 7, englishName: "Lixing Building", chineseName: "力行楼", x: 61, y: 57, passengerCount: 0 },
  { id: 8, englishName: "School Hospital", chineseName: "校医院", x: 76, y: 57, passengerCount: 2 },
  { id: 9, englishName: "Engineering College", chineseName: "现代工学院", x: 61, y: 33, passengerCount: 0 },
  { id: 10, englishName: "Student Dormitory Area", chineseName: "学生公寓", x: 18, y: 40, passengerCount: 0 },
  { id: 11, englishName: "Yuweitang", chineseName: "余味堂", x: 23, y: 26, passengerCount: 1 },
  { id: 12, englishName: "Gewu Building", chineseName: "格物楼", x: 45, y: 60, passengerCount: 0 },
];

// Directed edges from the bus route-board. Both lines share the main chain,
// then Z52 ends at the Engineering College and Z53 ends at the West Gate.
export const routes: Route[] = [
  { id: 1, name: "East Gate to School Hospital", sourceStopId: 1, destinationStopId: 8, travelTimeMinutes: 3, delayMinutes: 0 },
  { id: 2, name: "School Hospital to Lixing Building", sourceStopId: 8, destinationStopId: 7, travelTimeMinutes: 3, delayMinutes: 0 },
  { id: 3, name: "Lixing Building to Gewu Building", sourceStopId: 7, destinationStopId: 12, travelTimeMinutes: 2, delayMinutes: 0 },
  { id: 4, name: "Gewu Building to YNU Library", sourceStopId: 12, destinationStopId: 6, travelTimeMinutes: 3, delayMinutes: 0 },
  { id: 5, name: "YNU Library to Yuweitang", sourceStopId: 6, destinationStopId: 11, travelTimeMinutes: 3, delayMinutes: 0 },
  { id: 6, name: "Yuweitang to Zehu Lake", sourceStopId: 11, destinationStopId: 5, travelTimeMinutes: 3, delayMinutes: 0 },
  { id: 7, name: "Zehu Lake to YNU North Gate", sourceStopId: 5, destinationStopId: 2, travelTimeMinutes: 4, delayMinutes: 0 },
  { id: 8, name: "YNU North Gate to Engineering College", sourceStopId: 2, destinationStopId: 9, travelTimeMinutes: 5, delayMinutes: 0 },
  { id: 9, name: "YNU North Gate to YNU West Gate", sourceStopId: 2, destinationStopId: 4, travelTimeMinutes: 6, delayMinutes: 0 },
  // Simulation connector for optimization demonstration only. It is not part
  // of the real Yunnan University bus route-board (lines Z52 and Z53).
  { id: 10, name: "Optimization Connector", sourceStopId: 12, destinationStopId: 9, travelTimeMinutes: 19, delayMinutes: 0, isSimulation: true },
];

// The route id that the emergency delay scenario targets.
export const DELAY_ROUTE_ID = 5; // YNU Library to Yuweitang

export const busLines: BusLine[] = [
  {
    code: "Z52",
    displayName: "YNU Engineering Express",
    label: "YNU Engineering Express (East Gate - Engineering College)",
    // Royal Blue: the primary YNU Smart Mobility brand color.
    color: "#2563eb",
    stopIds: [1, 8, 7, 12, 6, 11, 5, 2, 9],
  },
  {
    code: "Z53",
    displayName: "YNU Campus Connector",
    label: "YNU Campus Connector (East Gate - West Gate)",
    // Electric Green: the secondary brand accent, so the app's two real
    // bus lines now map directly onto the two-tone brand identity.
    color: "#22c55e",
    stopIds: [1, 8, 7, 12, 6, 11, 5, 2, 4],
  },
];

// Look up the custom display name for a route-board code.
export function lineDisplayName(code: string): string {
  return busLines.find((l) => l.code === code)?.displayName ?? code;
}

export const buses: Bus[] = [
  { id: 1, plateNumber: "BUS-Z52A", capacity: 40, onboardCount: 22, line: "Z52" },
  { id: 2, plateNumber: "BUS-Z53A", capacity: 35, onboardCount: 30, line: "Z53" },
  { id: 3, plateNumber: "BUS-Z52B", capacity: 45, onboardCount: 10, line: "Z52" },
];

export const schedules: Schedule[] = [
  { id: 1, line: "Z52", busId: 1, departure: { hour: 8, minute: 30 }, arrival: { hour: 8, minute: 56 } },
  { id: 2, line: "Z53", busId: 2, departure: { hour: 12, minute: 0 }, arrival: { hour: 12, minute: 27 } },
  { id: 3, line: "Z52", busId: 3, departure: { hour: 17, minute: 0 }, arrival: { hour: 17, minute: 26 } },
];

// Sample passenger queues per stop, used by the queue visualization.
export const stopQueues: Record<number, string[]> = {
  6: ["Ali", "Bina", "Chen", "Dora", "Eshan", "Farah"],
  8: ["Gita", "Hong"],
  11: ["Iqbal"],
};

export function isPeakHour(time: TimeSlot): boolean {
  const h = time.hour;
  const morning = h >= MORNING_PEAK_START_HOUR && h < MORNING_PEAK_END_HOUR;
  const afternoon = h >= AFTERNOON_PEAK_START_HOUR && h < AFTERNOON_PEAK_END_HOUR;
  return morning || afternoon;
}

export function formatTime(time: TimeSlot): string {
  const hh = time.hour < 10 ? "0" + time.hour : String(time.hour);
  const mm = time.minute < 10 ? "0" + time.minute : String(time.minute);
  return hh + ":" + mm;
}

export function getStop(id: number): Stop | undefined {
  return stops.find((s) => s.id === id);
}

export function stopName(id: number): string {
  return getStop(id)?.englishName ?? "Unknown";
}

export function stopChinese(id: number): string {
  return getStop(id)?.chineseName ?? "";
}

// Travel time on the edge that connects two stops, or 0 if there is none.
export function edgeTime(fromId: number, toId: number): number {
  const edge = routes.find(
    (r) => r.sourceStopId === fromId && r.destinationStopId === toId
  );
  return edge ? edge.travelTimeMinutes : 0;
}
