import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@0.0.4";

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNaskhArabic/NotoNaskhArabic-Regular.ttf";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const LINE_HEIGHT = 22;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { trip_id, type } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "servant") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: trip } = await supabase
      .from("trips")
      .select("*")
      .eq("id", trip_id)
      .single();

    if (!trip) {
      return new Response(JSON.stringify({ error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fontResp = await fetch(FONT_URL);
    if (!fontResp.ok) {
      throw new Error("Failed to fetch Arabic font");
    }
    const fontBytes = await fontResp.arrayBuffer();

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

    function rightAlignText(text: string, size: number): number {
      const width = font.widthOfTextAtSize(text, size);
      return PAGE_WIDTH - MARGIN_RIGHT - width;
    }

    function drawText(text: string, size: number = 12) {
      ensureSpace(LINE_HEIGHT);
      page.drawText(text, {
        x: rightAlignText(text, size),
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

    if (type === "bus") {
      drawText("تقرير الأتوبيسات", 20);
      drawText(trip.title_ar, 16);
      drawText(trip.trip_date, 12);
      y -= 10;
      drawSeparator();

      const { data: buses } = await supabase
        .from("buses")
        .select("*")
        .eq("trip_id", trip_id);

      for (const bus of buses || []) {
        ensureSpace(LINE_HEIGHT * 4);
        drawText(bus.area_name_ar, 14);
        drawText("المسؤول: " + (bus.leader_name || "—"), 12);

        const { data: bookings } = await supabase
          .from("bookings")
          .select("user_id")
          .eq("bus_id", bus.id)
          .is("cancelled_at", null);

        const userIds = (bookings || []).map((b: any) => b.user_id);
        drawText(
          "السعة: " + bus.capacity + " | الركاب: " + userIds.length,
          12
        );

        if (userIds.length > 0) {
          const { data: passengers } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          for (let i = 0; i < (passengers || []).length; i++) {
            const p = (passengers || [])[i];
            drawText(
              i +
                1 +
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
    } else {
      drawText("تقرير الأوض", 20);
      drawText(trip.title_ar, 16);
      drawText(trip.trip_date, 12);
      y -= 10;
      drawSeparator();

      const { data: rooms } = await supabase
        .from("rooms")
        .select("*")
        .eq("trip_id", trip_id);

      for (const room of rooms || []) {
        ensureSpace(LINE_HEIGHT * 4);
        drawText(room.room_label + " (" + room.room_type + ")", 14);
        drawText("المشرف: " + (room.supervisor_name || "—"), 12);

        const { data: bookings } = await supabase
          .from("bookings")
          .select("user_id")
          .eq("room_id", room.id)
          .is("cancelled_at", null);

        const userIds = (bookings || []).map((b: any) => b.user_id);
        drawText(
          "السعة: " + room.capacity + " | النزلاء: " + userIds.length,
          12
        );

        if (userIds.length > 0) {
          const { data: occupants } = await supabase
            .from("profiles")
            .select("full_name, phone, gender")
            .in("id", userIds);

          for (let i = 0; i < (occupants || []).length; i++) {
            const o = (occupants || [])[i];
            drawText(
              i +
                1 +
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
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="' + type + '-report.pdf"',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
