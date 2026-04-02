import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Trip, Bus, Room } from "@/lib/types/database";

interface Passenger {
  full_name: string;
  phone: string;
  gender: string;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const LINE_HEIGHT = 22;

let cachedFont: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (cachedFont) return cachedFont;
  const response = await fetch("/fonts/NotoNaskhArabic-Regular.ttf");
  cachedFont = await response.arrayBuffer();
  return cachedFont;
}

function rightAlign(
  text: string,
  fontSize: number,
  font: { widthOfTextAtSize: (text: string, size: number) => number }
): number {
  const width = font.widthOfTextAtSize(text, fontSize);
  return PAGE_WIDTH - MARGIN_RIGHT - width;
}

export async function generateBusReportPDF(
  trip: Trip,
  buses: Bus[],
  getPassengers: (busId: string) => Promise<Passenger[]>
): Promise<Uint8Array> {
  const fontBytes = await loadFont();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  function drawText(text: string, size: number = 12) {
    ensureSpace(LINE_HEIGHT);
    page.drawText(text, {
      x: rightAlign(text, size, font),
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    y -= size > 14 ? LINE_HEIGHT + 4 : LINE_HEIGHT;
  }

  function drawSeparator() {
    ensureSpace(10);
    page.drawLine({
      start: { x: MARGIN_RIGHT, y: y + 5 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: y + 5 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 10;
  }

  drawText("تقرير الأتوبيسات", 20);
  drawText(trip.title_ar, 16);
  drawText(trip.trip_date, 12);
  y -= 10;
  drawSeparator();

  for (const bus of buses) {
    ensureSpace(LINE_HEIGHT * 4);
    drawText(bus.area_name_ar, 14);
    drawText("المسؤول: " + (bus.leader_name || "—"), 12);

    const passengers = await getPassengers(bus.id);
    drawText(
      "السعة: " + bus.capacity + " | الركاب: " + passengers.length,
      12
    );

    if (passengers.length > 0) {
      for (let i = 0; i < passengers.length; i++) {
        const p = passengers[i];
        drawText(
          (i + 1) +
            ". " +
            p.full_name +
            " (" +
            p.phone +
            ") [" +
            p.gender +
            "]",
          11
        );
      }
    } else {
      drawText("لا يوجد ركاب", 11);
    }

    y -= 5;
    drawSeparator();
  }

  return pdfDoc.save();
}

export async function generateRoomReportPDF(
  trip: Trip,
  rooms: Room[],
  getOccupants: (roomId: string) => Promise<Passenger[]>
): Promise<Uint8Array> {
  const fontBytes = await loadFont();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN_BOTTOM) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  function drawText(text: string, size: number = 12) {
    ensureSpace(LINE_HEIGHT);
    page.drawText(text, {
      x: rightAlign(text, size, font),
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
    y -= size > 14 ? LINE_HEIGHT + 4 : LINE_HEIGHT;
  }

  function drawSeparator() {
    ensureSpace(10);
    page.drawLine({
      start: { x: MARGIN_RIGHT, y: y + 5 },
      end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: y + 5 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 10;
  }

  drawText("تقرير الأوض", 20);
  drawText(trip.title_ar, 16);
  drawText(trip.trip_date, 12);
  y -= 10;
  drawSeparator();

  for (const room of rooms) {
    ensureSpace(LINE_HEIGHT * 4);
    drawText(room.room_label + " (" + room.room_type + ")", 14);
    drawText("المشرف: " + (room.supervisor_name || "—"), 12);

    const occupants = await getOccupants(room.id);
    drawText(
      "السعة: " + room.capacity + " | النزلاء: " + occupants.length,
      12
    );

    if (occupants.length > 0) {
      for (let i = 0; i < occupants.length; i++) {
        const o = occupants[i];
        drawText(
          (i + 1) +
            ". " +
            o.full_name +
            " (" +
            o.phone +
            ") [" +
            o.gender +
            "]",
          11
        );
      }
    } else {
      drawText("لا يوجد نزلاء", 11);
    }

    y -= 5;
    drawSeparator();
  }

  return pdfDoc.save();
}
