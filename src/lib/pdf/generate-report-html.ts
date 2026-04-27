import type { Trip, Bus, Room, Car, TripStats } from "@/lib/types/database";

export interface ReportPassenger {
  full_name: string;
  phone: string;
  gender: string;
  role?: string;
  sector_name?: string;
  has_wheelchair: boolean;
  family_member_id?: string | null;
  user_id?: string | null;
  head_user_id?: string | null;
  bus_id?: string | null;
  bus_label?: string | null;
  room_id?: string | null;
  room_label?: string | null;
  car_id?: string | null;
  car_label?: string | null;
}

export interface ReportData {
  trip: Trip;
  stats: TripStats | null;
  buses: Bus[];
  rooms: Room[];
  cars: Car[];
  passengers: ReportPassenger[];
  busPassengers: Map<string, ReportPassenger[]>;
  roomOccupants: Map<string, ReportPassenger[]>;
  carPassengers: Map<string, ReportPassenger[]>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function genderAr(g: string): string {
  return g === "Male" ? "\u0630\u0643\u0631" : "\u0623\u0646\u062B\u0649";
}

function wheelIcon(has: boolean): string {
  return has ? "\u2713" : "";
}

function pct(filled: number, total: number): number {
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

function fillBarHTML(filled: number, total: number): string {
  const p = pct(filled, total);
  const color = p < 70 ? "#2e9e5a" : p < 90 ? "#eab908" : "#d93025";
  return `<div class="fill-bar-track"><div class="fill-bar-fill" style="width:${p}%;background:${color}"></div></div>`;
}

function statBoxHTML(label: string, value: string | number): string {
  return `<div class="stat-box"><div class="stat-val">${esc(String(value))}</div><div class="stat-lbl">${esc(label)}</div></div>`;
}

function tableHeaderHTML(cols: string[]): string {
  return "<thead><tr>" + cols.map(c => `<th>${esc(c)}</th>`).join("") + "</tr></thead>";
}

function tableRowHTML(cols: string[], alt: boolean): string {
  const cls = alt ? ' class="alt"' : "";
  return "<tr" + cls + ">" + cols.map(c => `<td>${esc(c)}</td>`).join("") + "</tr>";
}

function groupByHead(passengers: ReportPassenger[]): { head: ReportPassenger | null; members: ReportPassenger[] }[] {
  const heads = passengers.filter(p => !p.family_member_id);
  const members = passengers.filter(p => !!p.family_member_id);
  return heads.map(head => ({
    head,
    members: members.filter(m => m.head_user_id === head.user_id),
  }));
}

function passengerTableHTML(
  passengers: ReportPassenger[],
  cols: string[],
  getRow: (p: ReportPassenger, idx: number, isFamily: boolean) => string[]
): string {
  if (passengers.length === 0) return "";
  let html = "<table>" + tableHeaderHTML(cols);
  let idx = 0;
  const grouped = groupByHead(passengers);
  for (const group of grouped) {
    if (group.head) {
      idx++;
      html += tableRowHTML(getRow(group.head, idx, false), idx % 2 === 0);
    }
    for (const m of group.members) {
      html += tableRowHTML(getRow(m, idx, true), idx % 2 === 0);
    }
  }
  return html + "</table>";
}

function section1Summary(data: ReportData): string {
  const { trip, stats, passengers } = data;
  const totalBooked = passengers.length;
  const familyCount = passengers.filter(p => !!p.family_member_id).length;
  const wheelCount = passengers.filter(p => p.has_wheelchair).length;

  let html = `<div class="section"><h2>\u0645\u0644\u062E\u0635 \u0627\u0644\u0631\u062D\u0644\u0629</h2>`;
  html += `<div class="trip-title">${esc(trip.title_ar)}</div>`;
  html += `<div class="trip-meta">${esc(trip.trip_date)} &nbsp;|&nbsp; ${trip.is_open ? "\u0645\u0641\u062A\u0648\u062D\u0629 \u0644\u0644\u062D\u062C\u0632" : "\u0645\u0642\u0641\u0648\u0644\u0629"}</div>`;

  html += `<div class="stat-row">`;
  html += statBoxHTML("\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062D\u062C\u0648\u0632\u064A\u0646", totalBooked);
  html += statBoxHTML("\u0623\u0641\u0631\u0627\u062F \u0627\u0644\u0639\u0627\u0626\u0644\u0629", familyCount);
  html += statBoxHTML("\u0643\u0631\u0627\u0633\u064A \u0645\u062A\u062D\u0631\u0643\u0629", wheelCount);
  html += statBoxHTML("\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0633\u062C\u0644\u064A\u0646", stats?.total_registered ?? 0);
  html += `</div>`;

  if (stats) {
    const roleEntries = Object.entries(stats.by_role);
    if (roleEntries.length > 0) {
      html += `<h3>\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u062D\u0633\u0628 \u0627\u0644\u062F\u0648\u0631</h3>`;
      html += "<table>" + tableHeaderHTML(["\u0627\u0644\u062F\u0648\u0631", "\u0627\u0644\u0639\u062F\u062F", "\u0627\u0644\u0646\u0633\u0628\u0629"]);
      roleEntries.forEach(([role, count], i) => {
        const p = totalBooked > 0 ? Math.round((count / totalBooked) * 100) + "%" : "0%";
        html += tableRowHTML([role, String(count), p], i % 2 === 1);
      });
      html += "</table>";
    }

    html += `<h3>\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u062D\u0633\u0628 \u0627\u0644\u0646\u0648\u0639</h3>`;
    const gTotal = stats.by_gender.Male + stats.by_gender.Female;
    html += "<table>" + tableHeaderHTML(["\u0627\u0644\u0646\u0648\u0639", "\u0627\u0644\u0639\u062F\u062F", "\u0627\u0644\u0646\u0633\u0628\u0629"]);
    html += tableRowHTML(["\u0630\u0643\u0648\u0631", String(stats.by_gender.Male), gTotal > 0 ? Math.round((stats.by_gender.Male / gTotal) * 100) + "%" : "0%"], false);
    html += tableRowHTML(["\u0625\u0646\u0627\u062B", String(stats.by_gender.Female), gTotal > 0 ? Math.round((stats.by_gender.Female / gTotal) * 100) + "%" : "0%"], true);
    html += "</table>";

    const tb = stats.transport_breakdown;
    html += `<h3>\u0648\u0633\u064A\u0644\u0629 \u0627\u0644\u0646\u0642\u0644</h3>`;
    html += "<table>" + tableHeaderHTML(["\u0627\u0644\u0646\u0648\u0639", "\u0627\u0644\u0639\u062F\u062F"]);
    html += tableRowHTML(["\u0623\u062A\u0648\u0628\u064A\u0633", String(tb.on_bus)], false);
    html += tableRowHTML(["\u0639\u0631\u0628\u064A\u0629", String(tb.in_car)], true);
    html += tableRowHTML(["\u0628\u062F\u0648\u0646 \u0646\u0642\u0644", String(tb.no_transport)], false);
    html += "</table>";

    const sn = stats.servants_needed;
    html += `<h3>\u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629</h3>`;
    html += "<table>" + tableHeaderHTML(["\u0639\u062F\u062F \u0627\u0644\u062E\u062F\u0627\u0645", "\u0627\u0644\u0639\u062F\u062F"]);
    ["0", "1", "2"].forEach((k, i) => {
      html += tableRowHTML([k + " \u062E\u0627\u062F\u0645", String(sn[k] ?? 0)], i % 2 === 1);
    });
    html += "</table>";

    if (stats.by_sector.length > 0) {
      html += `<h3>\u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u062D\u0633\u0628 \u0627\u0644\u0642\u0637\u0627\u0639\u0629</h3>`;
      html += "<table>" + tableHeaderHTML(["\u0627\u0644\u0642\u0637\u0627\u0639\u0629", "\u0627\u0644\u0639\u062F\u062F"]);
      stats.by_sector.forEach((s, i) => {
        html += tableRowHTML([s.name, String(s.count)], i % 2 === 1);
      });
      html += "</table>";
    }

    if (stats.bus_stats.total_seats > 0) {
      const { filled, total_seats } = stats.bus_stats;
      const p = pct(filled, total_seats);
      html += `<h3>\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0623\u062A\u0648\u0628\u064A\u0633\u0627\u062A</h3>`;
      html += `<div class="bar-label">\u0627\u0644\u0645\u0642\u0627\u0639\u062F: ${filled} / ${total_seats} (${p}%)</div>`;
      html += fillBarHTML(filled, total_seats);
    }

    if (stats.room_stats.total_capacity > 0) {
      const { assigned, total_capacity } = stats.room_stats;
      const p = pct(assigned, total_capacity);
      html += `<h3>\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0623\u0648\u0636</h3>`;
      html += `<div class="bar-label">\u0627\u0644\u0646\u0632\u0644\u0627\u0621: ${assigned} / ${total_capacity} (${p}%)</div>`;
      html += fillBarHTML(assigned, total_capacity);
    }
  }

  html += `</div>`;
  return html;
}

function section2Buses(data: ReportData): string {
  const { buses, busPassengers } = data;
  if (buses.length === 0) return "";

  let html = `<div class="section page-break"><h2>\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0623\u062A\u0648\u0628\u064A\u0633\u0627\u062A</h2>`;

  const grouped = new Map<string, Bus[]>();
  for (const bus of buses) {
    const key = bus.area_id || bus.area_name_ar;
    const group = grouped.get(key) || [];
    group.push(bus);
    grouped.set(key, group);
  }

  for (const areaBuses of Array.from(grouped.values())) {
    const areaName = areaBuses[0]?.area_name_ar || "";
    const areaWheels = areaBuses.reduce((sum, b) => {
      return sum + (busPassengers.get(b.id) || []).filter(p => p.has_wheelchair).length;
    }, 0);
    html += `<h3>${esc(areaName)}${areaWheels > 0 ? ` (\u0643\u0631\u0627\u0633\u064A: ${areaWheels})` : ""}</h3>`;

    for (const bus of areaBuses) {
      const pax = busPassengers.get(bus.id) || [];
      const wheelPax = pax.filter(p => p.has_wheelchair).length;
      const filled = pax.length;
      const total = bus.capacity;
      const p = pct(filled, total);
      const label = bus.bus_label || bus.area_name_ar;

      html += `<div class="bus-header">`;
      html += `<span class="bus-name">${esc(label)}</span>`;
      html += `<span class="bus-cap">${filled}/${total} &mdash; ${p}%</span>`;
      if (wheelPax > 0) html += `<span class="bus-wheel">[\u0643\u0631\u0627\u0633\u064A: ${wheelPax}]</span>`;
      html += `</div>`;
      if (bus.leader_name) {
        html += `<div class="bus-leader">\u0627\u0644\u0645\u0633\u0624\u0648\u0644: ${esc(bus.leader_name)}</div>`;
      }
      html += fillBarHTML(filled, total);

      html += passengerTableHTML(
        pax,
        ["#", "\u0627\u0644\u0627\u0633\u0645", "\u0627\u0644\u0647\u0627\u062A\u0641", "\u0627\u0644\u0646\u0648\u0639", "\u0627\u0644\u0642\u0637\u0627\u0639\u0629", "\u0643\u0631\u0633\u064A", "\u0627\u0644\u062F\u0648\u0631"],
        (p, idx, isFam) => [
          isFam ? "" : String(idx),
          isFam ? "&rarr; " + esc(p.full_name) : esc(p.full_name),
          isFam ? "" : esc(p.phone),
          genderAr(p.gender),
          isFam ? "" : (p.sector_name || ""),
          wheelIcon(p.has_wheelchair),
          isFam ? "" : (p.role || ""),
        ]
      );
    }
  }

  html += `</div>`;
  return html;
}

function section3Cars(data: ReportData): string {
  const { cars, carPassengers } = data;
  if (cars.length === 0) return "";

  let html = `<div class="section page-break"><h2>\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0639\u0631\u0628\u064A\u0627\u062A</h2>`;

  for (const car of cars) {
    const pax = carPassengers.get(car.id) || [];
    const label = car.car_label || "\u0639\u0631\u0628\u064A\u0629";
    html += `<div class="bus-header"><span class="bus-name">${esc(label)}</span><span class="bus-cap">${pax.length}/${car.capacity}</span></div>`;

    if (pax.length > 0) {
      html += passengerTableHTML(
        pax,
        ["#", "\u0627\u0644\u0627\u0633\u0645", "\u0627\u0644\u0647\u0627\u062A\u0641", "\u0627\u0644\u0646\u0648\u0639", "\u0627\u0644\u0642\u0637\u0627\u0639\u0629", "\u0643\u0631\u0633\u064A", "\u0627\u0644\u062F\u0648\u0631"],
        (p, idx, isFam) => [
          isFam ? "" : String(idx),
          isFam ? "&rarr; " + esc(p.full_name) : esc(p.full_name),
          isFam ? "" : esc(p.phone),
          genderAr(p.gender),
          isFam ? "" : (p.sector_name || ""),
          wheelIcon(p.has_wheelchair),
          isFam ? "" : (p.role || ""),
        ]
      );
    } else {
      html += `<div class="empty-msg">\u0644\u0627 \u064A\u0648\u062C\u062F \u0631\u0643\u0627\u0628</div>`;
    }
  }

  html += `</div>`;
  return html;
}

function section4Rooms(data: ReportData): string {
  const { rooms, roomOccupants } = data;
  if (rooms.length === 0) return "";

  let html = `<div class="section page-break"><h2>\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0623\u0648\u0636</h2>`;

  const byType = new Map<string, Room[]>();
  for (const room of rooms) {
    const group = byType.get(room.room_type) || [];
    group.push(room);
    byType.set(room.room_type, group);
  }

  for (const [roomType, typeRooms] of Array.from(byType.entries())) {
    const typeLabel = roomType === "Male" ? "\u0623\u0648\u0636 \u0630\u0643\u0648\u0631" : "\u0623\u0648\u0636 \u0625\u0646\u0627\u062B";
    html += `<h3>${esc(typeLabel)}</h3>`;

    for (const room of typeRooms) {
      const occ = roomOccupants.get(room.id) || [];
      const wheelOcc = occ.filter(p => p.has_wheelchair).length;
      const filled = occ.length;
      const total = room.capacity;
      const p = pct(filled, total);

      html += `<div class="bus-header">`;
      html += `<span class="bus-name">${esc(room.room_label)}</span>`;
      html += `<span class="bus-cap">${filled}/${total} &mdash; ${p}%</span>`;
      if (wheelOcc > 0) html += `<span class="bus-wheel">[\u0643\u0631\u0627\u0633\u064A: ${wheelOcc}]</span>`;
      html += `</div>`;
      if (room.supervisor_name) {
        html += `<div class="bus-leader">\u0627\u0644\u0645\u0634\u0631\u0641: ${esc(room.supervisor_name)}</div>`;
      }
      html += fillBarHTML(filled, total);

      html += passengerTableHTML(
        occ,
        ["#", "\u0627\u0644\u0627\u0633\u0645", "\u0627\u0644\u0647\u0627\u062A\u0641", "\u0627\u0644\u0646\u0648\u0639", "\u0627\u0644\u0642\u0637\u0627\u0639\u0629", "\u0643\u0631\u0633\u064A", "\u0627\u0644\u062F\u0648\u0631"],
        (p, idx, isFam) => [
          isFam ? "" : String(idx),
          isFam ? "&rarr; " + esc(p.full_name) : esc(p.full_name),
          isFam ? "" : esc(p.phone),
          genderAr(p.gender),
          isFam ? "" : (p.sector_name || ""),
          wheelIcon(p.has_wheelchair),
          isFam ? "" : (p.role || ""),
        ]
      );
    }
  }

  html += `</div>`;
  return html;
}

function section5Wheelchair(data: ReportData): string {
  const wheelUsers = data.passengers.filter(p => p.has_wheelchair);
  if (wheelUsers.length === 0) return "";

  let html = `<div class="section page-break"><h2>\u0642\u0627\u0626\u0645\u0629 \u0645\u0633\u062A\u062E\u062F\u0645\u064A \u0627\u0644\u0643\u0631\u0627\u0633\u064A \u0627\u0644\u0645\u062A\u062D\u0631\u0643\u0629 (${wheelUsers.length})</h2>`;

  html += "<table>" + tableHeaderHTML(["#", "\u0627\u0644\u0627\u0633\u0645", "\u0627\u0644\u0647\u0627\u062A\u0641", "\u0627\u0644\u0646\u0648\u0639", "\u0627\u0644\u0642\u0637\u0627\u0639\u0629", "\u0627\u0644\u0623\u062A\u0648\u0628\u064A\u0633", "\u0627\u0644\u0623\u0648\u0636\u0629", "\u0627\u0644\u062F\u0648\u0631"]);
  wheelUsers.forEach((p, i) => {
    html += tableRowHTML([
      String(i + 1),
      esc(p.full_name),
      esc(p.phone),
      genderAr(p.gender),
      p.sector_name || "",
      p.bus_label || "-",
      p.room_label || "-",
      p.role || "",
    ], i % 2 === 1);
  });
  html += "</table></div>";
  return html;
}

function section6Unassigned(data: ReportData): string {
  const heads = data.passengers.filter(p => !p.family_member_id);
  const noTransport = heads.filter(p => !p.bus_id && !p.car_id);
  const noRoom = heads.filter(p => !p.room_id);

  let html = `<div class="section page-break"><h2>\u0627\u0644\u0631\u0643\u0627\u0628 \u0628\u062F\u0648\u0646 \u062A\u0639\u064A\u064A\u0646</h2>`;

  const sections: { title: string; data: ReportPassenger[] }[] = [
    { title: `\u0628\u062F\u0648\u0646 \u0623\u062A\u0648\u0628\u064A\u0633 \u0623\u0648 \u0639\u0631\u0628\u064A\u0629 (${noTransport.length})`, data: noTransport },
    { title: `\u0628\u062F\u0648\u0646 \u0623\u0648\u0636\u0629 (${noRoom.length})`, data: noRoom },
  ];

  for (const section of sections) {
    html += `<h3>${esc(section.title)}</h3>`;
    if (section.data.length === 0) {
      html += `<div class="empty-msg">\u0627\u0644\u0643\u0644 \u0645\u062A\u0639\u064A\u0646</div>`;
      continue;
    }

    html += "<table>" + tableHeaderHTML(["#", "\u0627\u0644\u0627\u0633\u0645", "\u0627\u0644\u0647\u0627\u062A\u0641", "\u0627\u0644\u0646\u0648\u0639", "\u0627\u0644\u0642\u0637\u0627\u0639\u0629", "\u0643\u0631\u0633\u064A", "\u0627\u0644\u062F\u0648\u0631"]);
    section.data.forEach((p, i) => {
      html += tableRowHTML([
        String(i + 1),
        esc(p.full_name),
        esc(p.phone),
        genderAr(p.gender),
        p.sector_name || "",
        wheelIcon(p.has_wheelchair),
        p.role || "",
      ], i % 2 === 1);
    });
    html += "</table>";
  }

  html += `</div>`;
  return html;
}

export function generateReportHTML(data: ReportData): string {
  const { trip } = data;

  const body =
    section1Summary(data) +
    section2Buses(data) +
    section3Cars(data) +
    section4Rooms(data) +
    section5Wheelchair(data) +
    section6Unassigned(data);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>${esc(trip.title_ar)} - \u062A\u0642\u0631\u064A\u0631</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
  direction: rtl;
  background: #f5f5f5;
  color: #222;
  font-size: 13px;
  line-height: 1.5;
  padding: 20px;
}

.print-header {
  display: none;
}

.section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

h2 {
  background: #1a57d4;
  color: #fff;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 16px;
  margin-bottom: 14px;
}

h3 {
  background: #e8ecfa;
  color: #1a57d4;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  margin: 14px 0 10px;
}

.trip-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a57d4;
  margin-bottom: 4px;
}

.trip-meta {
  font-size: 14px;
  color: #555;
  margin-bottom: 14px;
}

.stat-row {
  display: flex;
  gap: 10px;
  margin: 14px 0;
  flex-wrap: wrap;
}

.stat-box {
  flex: 1;
  min-width: 120px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 10px 8px;
  text-align: center;
}

.stat-val {
  font-size: 24px;
  font-weight: 700;
  color: #1a57d4;
}

.stat-lbl {
  font-size: 11px;
  color: #555;
  margin-top: 2px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0 12px;
  font-size: 12px;
}

th {
  background: #1a57d4;
  color: #fff;
  padding: 7px 8px;
  text-align: right;
  font-weight: 600;
}

td {
  padding: 6px 8px;
  border-bottom: 1px solid #eee;
  text-align: right;
}

tr.alt td {
  background: #f7f7f7;
}

.bus-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0 4px;
  flex-wrap: wrap;
}

.bus-name {
  font-size: 14px;
  font-weight: 700;
  color: #1a57d4;
}

.bus-cap {
  font-size: 13px;
  color: #555;
}

.bus-wheel {
  font-size: 12px;
  color: #d93025;
}

.bus-leader {
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
}

.fill-bar-track {
  width: 100%;
  height: 10px;
  background: #eee;
  border-radius: 5px;
  overflow: hidden;
  margin: 4px 0 10px;
}

.fill-bar-fill {
  height: 100%;
  border-radius: 5px;
}

.bar-label {
  font-size: 12px;
  color: #555;
  margin-bottom: 2px;
}

.empty-msg {
  text-align: center;
  color: #999;
  padding: 12px;
  font-style: italic;
}

@media print {
  body {
    background: #fff;
    padding: 0;
    font-size: 11px;
  }

  .section {
    box-shadow: none;
    border-radius: 0;
    padding: 10px 0;
    border-bottom: 1px solid #ddd;
  }

  h2 {
    font-size: 14px;
    padding: 6px 12px;
  }

  h3 {
    font-size: 12px;
    padding: 4px 10px;
  }

  .page-break {
    page-break-before: always;
  }

  table {
    font-size: 10px;
  }

  th, td {
    padding: 4px 6px;
  }

  .stat-box {
    padding: 6px 4px;
  }

  .stat-val {
    font-size: 18px;
  }

  .stat-lbl {
    font-size: 9px;
  }
}
</style>
</head>
<body>
${body}
<script>
setTimeout(function(){ window.print(); }, 500);
</script>
</body>
</html>`;
}
