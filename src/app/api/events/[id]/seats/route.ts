import { prisma } from "@/lib/prisma";
import { getUnavailableSeatIds, priceForSeat } from "@/lib/tickets";

export const dynamic = "force-dynamic";

// Next 15+: params llega como Promesa
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: { venue: { include: { seats: true } } },
  });

  if (!event) {
    return new Response(JSON.stringify({ error: "Event not found" }), { status: 404 });
  }

  // asientos ocupados (tickets emitidos/usados + holds vigentes)
  const unavailable = await getUnavailableSeatIds(event.id);

  // construir seats para la UI
  const seats = event.venue.seats.map((s) => {
    const p = priceForSeat(event, s); // asegúrate que retorna { price, iva, total } en centavos
    return {
      id: s.id,
      row: s.row,
      col: s.col,
      label: s.label,
      price: p.price,
      iva: p.iva,
      total: p.total,
      available: !unavailable.has(s.id),
    };
  });

  // ⚠️ IMPORTANTE: la página espera event.venue anidado
  return Response.json({
    event: {
      id: event.id,
      name: event.name,
      date: event.date.toISOString(),
      venue: {
        name: event.venue.name,
        rows: event.venue.rows,
        cols: event.venue.cols,
      },
    },
    seats,
  });
}
