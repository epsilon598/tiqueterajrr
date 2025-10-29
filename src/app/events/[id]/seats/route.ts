// src/app/api/events/[id]/seats/route.ts
import { prisma } from "@/lib/prisma";
import { priceForSeat } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> } // 👈 promesa
) {
  const { id: eventId } = await ctx.params; // 👈 await

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { venue: { include: { seats: true } } },
    });
    if (!event) return new Response(JSON.stringify({ error: "Event not found" }), { status: 404 });

    const now = new Date();

    const tickets = await prisma.ticket.findMany({
      where: { eventId, status: { in: ["ISSUED", "USED"] } },
      select: { seatId: true },
    });
    const taken = new Set(tickets.map(t => t.seatId));

    const holds = await prisma.seatHold.findMany({
      where: { eventId, expiresAt: { gt: now } },
      select: { seatId: true },
    });
    const held = new Set(holds.map(h => h.seatId));

    const seats = event.venue.seats.map(s => {
      const p = priceForSeat(event, s);
      return {
        id: s.id,
        row: s.row,
        col: s.col,
        label: s.label,
        price: p.price,
        iva: p.iva,
        total: p.price + p.iva,
        available: !taken.has(s.id) && !held.has(s.id),
      };
    });

    return Response.json({
      event: {
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        venue: { name: event.venue.name, rows: event.venue.rows, cols: event.venue.cols },
      },
      seats,
    });
  } catch (e) {
    console.error("GET /api/events/[id]/seats error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
}
