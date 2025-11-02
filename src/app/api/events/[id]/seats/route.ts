// src/app/api/events/[id]/seats/route.ts
import { prisma } from "@/lib/prisma";
import type { NextRequest } from "next/server";
import { getUnavailableSeatIds } from "@/lib/tickets";

export const dynamic = "force-dynamic";

// Soportar ctx.params sin/ con Promise (según runtime)
type CtxPromise = { params: Promise<{ id: string }> };
type CtxPlain = { params: { id: string } };
type Ctx = CtxPromise | CtxPlain;

async function getIdFromCtx(ctx: Ctx): Promise<string> {
  const p: any = (ctx as any).params;
  if (p && typeof p.then === "function") {
    const v = await p;
    return v?.id as string;
  }
  return (p?.id ?? "") as string;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const id = await getIdFromCtx(ctx);
    if (!id) return Response.json({ error: "Falta id" }, { status: 400 });

    const ev = await prisma.event.findUnique({
      where: { id },
      include: { venue: true },
    });

    if (!ev || !ev.venue) {
      return Response.json({ event: null, seats: null }, { status: 404 });
    }

    const seats = await prisma.seat.findMany({
      where: { venueId: ev.venueId },
      select: { id: true, row: true, col: true, label: true, priceOverride: true },
      orderBy: [{ row: "asc" }, { col: "asc" }],
    });

    // 🔹 Disponibilidad real: tickets emitidos/used + holds vigentes
    const unavailable = await getUnavailableSeatIds(ev.id);

    // 🔹 Precios en CENTAVOS (si vinieron en pesos, convertir)
    const rawBase = Number(ev.basePrice ?? 0);
    const basePrice = rawBase < 100000 ? rawBase * 100 : rawBase; // -> centavos
    const ivaRate = Number(ev.ivaRate ?? 0);

    const enriched = seats.map((s) => {
      const rawOverride = s.priceOverride == null ? null : Number(s.priceOverride);
      const overrideCents =
        rawOverride == null ? null : rawOverride < 100000 ? rawOverride * 100 : rawOverride;

      const price = Number(overrideCents ?? basePrice); // CENTAVOS
      const iva = Math.round(price * ivaRate);
      const total = price + iva;

      return {
        id: s.id,
        row: s.row,
        col: s.col,
        label: s.label,
        price,
        iva,
        total,
        available: !unavailable.has(s.id), // ✅ ahora sí correcto
      };
    });

    return Response.json({
      event: {
        id: ev.id,
        name: ev.name,
        date: ev.date,
        venue: { name: ev.venue.name, rows: ev.venue.rows, cols: ev.venue.cols },
      },
      seats: enriched,
    });
  } catch (err) {
    console.error("[/api/events/[id]/seats] error:", err);
    const msg = err instanceof Error ? err.message : "Error inesperado";
    return Response.json({ error: msg }, { status: 500 });
  }
}
