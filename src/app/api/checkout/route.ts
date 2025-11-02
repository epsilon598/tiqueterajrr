// src/app/api/checkout/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { priceForSeat } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 1) Sesión
  const session = await getServerSession(authOptions);
  if (!session?.userId) return new Response("Unauthorized", { status: 401 });
  const userId: string = session.userId;

  // 2) Payload mínimo
  const body = await req.json().catch(() => null);
  const eventId = body?.eventId as string | undefined;
  if (!eventId) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
  }

  // 3) Evento + venue (para precios)
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: { include: { seats: true } } },
  });
  if (!event) return new Response("Event not found", { status: 404 });

  // 4) Holds vigentes del usuario
  const now = new Date();
  const holds = await prisma.seatHold.findMany({
    where: { userId, eventId, expiresAt: { gt: now } },
    include: { seat: true },
  });
  if (holds.length === 0) {
    return new Response(JSON.stringify({ error: "No tienes asientos apartados" }), { status: 400 });
  }

  // 5) Límite por usuario (si aplica)
  const maxPerUser = event.maxPerUser;
  if (maxPerUser != null) {
    const ticketsCount = await prisma.ticket.count({
      where: { userId, eventId, status: { in: ["ISSUED", "USED"] } },
    });
    const wouldBeTotal = holds.length + ticketsCount;
    if (wouldBeTotal > maxPerUser) {
      const remaining = Math.max(0, maxPerUser - ticketsCount);
      return new Response(
        JSON.stringify({ error: `Límite por usuario (${maxPerUser}) excedido. Te quedan ${remaining}.` }),
        { status: 409 }
      );
    }
  }

  // 6) Totales por asiento — priceForSeat debe devolver CENTAVOS
  let subtotal = 0;
  let iva = 0;
  for (const h of holds) {
    const p = priceForSeat(event, h.seat); // { price, iva } en centavos
    subtotal += p.price;
    iva += p.iva;
  }
  const total = subtotal + iva; // centavos

  // 7) Crea orden + "foto" de asientos (OrderSeat)
  const order = await prisma.order.create({
    data: {
      userId,
      eventId: event.id,
      status: "PENDING",
      subtotal,
      iva,
      total,
      items: {
        create: holds.map((h) => ({ seatId: h.seatId })),
      },
    },
    include: { items: { include: { seat: true } } },
  });

  // 8) No borrar holds aquí. Se liberan/cierran tras pago aprobado.

  // 9) Respuesta
  return Response.json({
    ok: true,
    orderId: order.id,
    amount: total,        // CENTAVOS — así lo espera Wompi
    currency: "COP",
    items: order.items.map((it) => ({ seatId: it.seatId, label: it.seat.label })),
  });
}
