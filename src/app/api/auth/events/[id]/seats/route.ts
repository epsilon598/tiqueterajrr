import { getEventWithVenue, getUnavailableSeatIds, priceForSeat } from "@/lib/tickets";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const event = await getEventWithVenue(params.id);
  if (!event) return new Response("Not found", { status: 404 });

  const unavailable = await getUnavailableSeatIds(event.id);

  const seats = event.venue.seats.map((s) => {
    const prices = priceForSeat(event, s);
    return {
      id: s.id,
      row: s.row,
      col: s.col,
      label: s.label,
      price: prices.price,
      iva: prices.iva,
      total: prices.total,
      available: !unavailable.has(s.id),
    };
  });

  return Response.json({
    event: { id: event.id, name: event.name, date: event.date, basePrice: event.basePrice, ivaRate: event.ivaRate, maxPerUser: event.maxPerUser },
    venue: { id: event.venue.id, name: event.venue.name, rows: event.venue.rows, cols: event.venue.cols },
    seats
  });
}
