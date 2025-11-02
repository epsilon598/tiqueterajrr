// src/app/api/webhooks/wompi/route.ts
import { prisma } from "@/lib/prisma";
import { generateQRDataURL } from "@/lib/tickets";
import { sendTicketsEmail } from "@/lib/mail";
import { composeQrWithSeatLabel } from "@/lib/qrImage";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

interface WompiTransaction {
  status: string;
  reference: string;
}
interface WompiWebhookEvent {
  event: string;
  data?: { transaction?: WompiTransaction };
}

export async function POST(req: Request) {
  const raw = await req.text();

  let parsed: WompiWebhookEvent;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const tr = parsed?.data?.transaction;
  if (!tr?.reference) return new Response("No reference", { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: tr.reference },
    include: { user: true, event: { include: { venue: true } } },
  });
  if (!order) return new Response("Order not found", { status: 404 });

  const NEGATIVE = new Set(["DECLINED", "REJECTED", "VOIDED", "ERROR", "FAILED"]);

  if (tr.status === "APPROVED" && order.status === "PENDING") {
    const holds = await prisma.seatHold.findMany({
      where: { userId: order.userId, eventId: order.eventId },
      include: { seat: true },
    });

    if (holds.length === 0) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
      });
      await prisma.seatHold.deleteMany({
        where: { userId: order.userId, eventId: order.eventId },
      });
      return new Response("ok", { status: 200 });
    }

    const existingBySeat = new Set(
      (
        await prisma.ticket.findMany({
          where: { orderId: order.id },
          select: { seatId: true },
        })
      ).map((t) => t.seatId)
    );

    const emailTickets: { seatLabel: string; qrPng: Buffer }[] = [];

    for (const h of holds) {
      if (existingBySeat.has(h.seatId)) continue;

      const seatLabel = h.seat.label;
      const qrValue = `TICKET:${order.id}:${h.seatId}:${crypto.randomUUID()}`;
      const qrDataURL = await generateQRDataURL(qrValue);

      await prisma.ticket.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          eventId: order.eventId,
          seatId: h.seatId,
          qrCodeValue: qrValue,
          status: "ISSUED",
        },
      });

      // DataURL -> Buffer y componer con el label
      const base64 = qrDataURL.split(",")[1] ?? "";
      const raw = Buffer.from(base64, "base64");
      const composed = await composeQrWithSeatLabel(seatLabel, raw);

      emailTickets.push({ seatLabel, qrPng: composed });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });

    await prisma.seatHold.deleteMany({
      where: { userId: order.userId, eventId: order.eventId },
    });

    try {
      await sendTicketsEmail({
        to: order.user.email,
        customerName: order.user.name ?? null,
        orderId: order.id,
        eventName: order.event.name,
        eventDate: order.event.date,
        venueName: order.event.venue.name,
        tickets: emailTickets,
      });
      console.log(`✅ Tickets enviados a ${order.user.email} (adjuntos: ${emailTickets.length})`);
    } catch (err) {
      console.error("❌ Error al enviar email:", err);
    }
  } else if (NEGATIVE.has(tr.status) && order.status === "PENDING") {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED", paymentRef: tr.status },
    });
    await prisma.seatHold.deleteMany({
      where: { userId: order.userId, eventId: order.eventId },
    });
  }

  return new Response("ok", { status: 200 });
}
