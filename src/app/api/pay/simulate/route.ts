// src/app/api/pay/simulate/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateQRDataURL } from "@/lib/tickets";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  // 🔒 Solo el admin puede usar este endpoint
  if (!session?.user || session.user.role !== "ADMIN") {
    return new Response("Forbidden: solo el administrador puede simular pagos", { status: 403 });
  }

  const { orderId } = await req.json().catch(() => ({} as any));
  if (!orderId) return new Response("Invalid payload", { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { event: true, items: { include: { seat: true } }, user: true },
  });
  if (!order) return new Response("Order not found", { status: 404 });
  if (order.status !== "PENDING") return new Response("Order not pending", { status: 400 });

  try {
    // Simulamos la aprobación del pago
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentRef: `SIM-${Date.now()}`,
      },
    });

    // Generamos tickets por cada asiento de la orden
    const images: { ticketId: string; png: string; filename: string }[] = [];

    for (const item of order.items) {
      const seat = item.seat;
      const qrValue = `TICKET-${order.id}-${seat.id}-${Date.now()}`;
      const qrDataURL = await generateQRDataURL(qrValue);

      const ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          eventId: order.eventId,
          seatId: seat.id,
          qrCodeValue: qrValue,
          status: "ISSUED",
        },
      });

      images.push({
        ticketId: ticket.id,
        png: qrDataURL,
        filename: `${order.event.name}-seat-${seat.label}.png`,
      });
    }

    return Response.json({ ok: true, count: images.length, images });
  } catch (err) {
    console.error("[/api/pay/simulate] error:", err);
    const msg = err instanceof Error ? err.message : "Unexpected error";
    return new Response(msg, { status: 500 });
  }
}
