import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
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

type PdfContext = {
  pdfDoc: PDFDocument;
  font: PDFFont;
  page: PDFPage;
  y: number;
};

function createPdfContext(pdfDoc: PDFDocument, font: Awaited<ReturnType<PDFDocument["embedFont"]>>): PdfContext {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { pdfDoc, font, page, y: PAGE_HEIGHT - MARGIN_TOP };
}

function ensureSpace(ctx: PdfContext, needed: number) {
  if (ctx.y - needed < MARGIN_BOTTOM) {
    ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN_TOP;
  }
}

function drawText(ctx: PdfContext, text: string, size: number = 12) {
  ensureSpace(ctx, LINE_HEIGHT);
  ctx.page.drawText(text, {
    x: rightAlign(text, size, ctx.font),
    y: ctx.y,
    size,
    font: ctx.font,
    color: rgb(0, 0, 0),
  });
  ctx.y -= size > 14 ? LINE_HEIGHT + 4 : LINE_HEIGHT;
}

function drawSeparator(ctx: PdfContext) {
  ensureSpace(ctx, 10);
  ctx.page.drawLine({
    start: { x: MARGIN_RIGHT, y: ctx.y + 5 },
    end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: ctx.y + 5 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  ctx.y -= 10;
}

function drawHeader(ctx: PdfContext, title: string, trip: Trip) {
  drawText(ctx, title, 20);
  drawText(ctx, trip.title_ar, 16);
  drawText(ctx, trip.trip_date, 12);
  ctx.y -= 10;
  drawSeparator(ctx);
}

async function initPdf(): Promise<PdfContext> {
  const fontBytes = await loadFont();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes);
  return createPdfContext(pdfDoc, font);
}

export async function generateBusReportPDF(
  trip: Trip,
  buses: Bus[],
  getPassengers: (busId: string) => Promise<Passenger[]>
): Promise<Uint8Array> {
  const ctx = await initPdf();

  drawHeader(ctx, "تقرير الأتوبيسات", trip);

  const grouped = new Map<string, Bus[]>();
  for (const bus of buses) {
    const key = bus.area_id || bus.area_name_ar;
    const group = grouped.get(key) || [];
    group.push(bus);
    grouped.set(key, group);
  }

  for (const groupBuses of Array.from(grouped.values())) {
    const areaName = groupBuses[0]?.area_name_ar || "";
    ensureSpace(ctx, LINE_HEIGHT * 2);
    drawText(ctx, "📍 " + areaName, 16);
    ctx.y -= 5;

    for (const bus of groupBuses) {
      ensureSpace(ctx, LINE_HEIGHT * 4);
      drawText(ctx, bus.bus_label || bus.area_name_ar, 14);
      drawText(ctx, "المسؤول: " + (bus.leader_name || "—"), 12);

      const passengers = await getPassengers(bus.id);
      drawText(ctx, "السعة: " + bus.capacity + " | الركاب: " + passengers.length, 12);

      if (passengers.length > 0) {
        for (let i = 0; i < passengers.length; i++) {
          const p = passengers[i];
          drawText(ctx, `${i + 1}. ${p.full_name} (${p.phone}) [${p.gender}]`, 11);
        }
      } else {
        drawText(ctx, "لا يوجد ركاب", 11);
      }

      ctx.y -= 5;
      drawSeparator(ctx);
    }
  }

  return ctx.pdfDoc.save();
}

export async function generateRoomReportPDF(
  trip: Trip,
  rooms: Room[],
  getOccupants: (roomId: string) => Promise<Passenger[]>
): Promise<Uint8Array> {
  const ctx = await initPdf();

  drawHeader(ctx, "تقرير الأوض", trip);

  for (const room of rooms) {
    ensureSpace(ctx, LINE_HEIGHT * 4);
    drawText(ctx, room.room_label + " (" + room.room_type + ")", 14);
    drawText(ctx, "المشرف: " + (room.supervisor_name || "—"), 12);

    const occupants = await getOccupants(room.id);
    drawText(ctx, "السعة: " + room.capacity + " | النزلاء: " + occupants.length, 12);

    if (occupants.length > 0) {
      for (let i = 0; i < occupants.length; i++) {
        const o = occupants[i];
        drawText(ctx, `${i + 1}. ${o.full_name} (${o.phone}) [${o.gender}]`, 11);
      }
    } else {
      drawText(ctx, "لا يوجد نزلاء", 11);
    }

    ctx.y -= 5;
    drawSeparator(ctx);
  }

  return ctx.pdfDoc.save();
}
