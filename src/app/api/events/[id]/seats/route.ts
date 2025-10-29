// src/app/api/events/[id]/seats/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await prisma.event.findUnique({
    where: { id: params.id },
    include: { venue: true },
  });

  if (!ev || !ev.venue) {
    return Response.json({ event: null, seats: null }, { status: 404 });
  }

  const seats = await prisma.seat.findMany({
    where: { venueId: ev.venueId },
    select: {
      id: true,
      row: true,
      col: true,
      label: true,
      priceOverride: true, // si no lo usas, no pasa nada
    },
    orderBy: [{ row: "asc" }, { col: "asc" }],
  });

  // Precio base e IVA del evento
  const basePrice = Number(ev.basePrice ?? 0); // en centavos
  const ivaRate = Number(ev.ivaRate ?? 0);     // p.ej. 0.19

  const enriched = seats.map((s) => {
    const price = Number(s.priceOverride ?? basePrice);
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
      available: true, // 🔸 mientras no tengas holds/ventas, márcalos disponibles
    };
  });

  return Response.json({
    event: {
      id: ev.id,
      name: ev.name,
      date: ev.date,
      venue: {
        name: ev.venue.name,
        rows: ev.venue.rows,
        cols: ev.venue.cols,
      },
    },
    seats: enriched,
  });
}
