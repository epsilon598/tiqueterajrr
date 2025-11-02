// src/app/api/wompi/confirm/route.ts
import { prisma } from "@/lib/prisma";
import { generateQRDataURL } from "@/lib/tickets";
import { sendTicketsEmail } from "@/lib/mail";
import { composeQrWithSeatLabel } from "@/lib/qrImage";
import crypto from "node:crypto";

// Mitigar IPv6 en Windows/Node si tu ISP causa timeouts a sandbox
import { setDefaultResultOrder } from "node:dns";
setDefaultResultOrder?.("ipv4first");

export const dynamic = "force-dynamic";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function httpGetWithTimeout(url: string, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const { orderId, transactionId } = await req.json().catch(() => ({}));
  if (!orderId || !transactionId) return new Response("Invalid payload", { status: 400 });

  // Permite forzar base de Wompi si tu red bloquea sandbox
  // WOMPI_API_URL=https://sandbox.wompi.co/v1
  // WOMPI_API_URL=https://production.wompi.co/v1
  const base = process.env.WOMPI_API_URL || "https://sandbox.wompi.co/v1";
  const url = `${base}/transactions/${transactionId}`;

  // 1er intento con timeout + reintento corto
  let resp: Response | null = null;
  try {
    resp = await httpGetWithTimeout(url, 6000);
  } catch {
    await delay(500);
    try {
      resp = await httpGetWithTimeout(url, 6000);
    } catch (e2) {
      console.error("Wompi lookup failed (network):", e2);
      return Response.json({ ok: true, status: "PENDING", finalized: false });
    }
  }

  if (!resp || !resp.ok) {
    return Response.json({ ok: true, status: "PENDING", finalized: false });
  }

  const info = await resp.json().catch(() => null);
  const tr = (info as any)?.data;
  if (!tr?.id || !tr?.reference || !tr?.status) {
    return Response.json({ ok: true, status: "PENDING", finalized: false });
  }
  if (tr.id !== transactionId || tr.reference !== orderId) {
    return new Response("Mismatch reference/id", { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      event: { include: { venue: true } },
      items: { include: { seat: true } },
    },
  });
  if (!order) return new Response("Order not found", { status: 404 });

  if (order.status === "PAID") {
    return Response.json({ ok: true, status: "PAID", finalized: false });
  }
  if (tr.status !== "APPROVED") {
    // DECLINED/VOIDED/PENDING: no finalizar
    return Response.json({ ok: true, status: tr.status, finalized: false });
  }

  // Emitir tickets sólo si aún no se emitieron
  const existing = await prisma.ticket.findMany({
    where: { orderId: order.id },
    select: { seatId: true },
  });
  const issued = new Set(existing.map((t) => t.seatId));
  const emailTickets: { seatLabel: string; qrPng: Buffer }[] = [];

  for (const it of order.items) {
    if (issued.has(it.seatId)) continue;

    const seatLabel = it.seat.label;
    const qrValue = `TICKET:${order.id}:${it.seatId}:${crypto.randomUUID()}`;
    const qrDataURL = await generateQRDataURL(qrValue);

    // DataURL -> Buffer y componer con el label
    const rawPng = Buffer.from(qrDataURL.split(",")[1] ?? "", "base64");
    const composedPng = await composeQrWithSeatLabel(seatLabel, rawPng);

    await prisma.ticket.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        eventId: order.eventId,
        seatId: it.seatId,
        qrCodeValue: qrValue,
        status: "ISSUED",
      },
    });

    emailTickets.push({ seatLabel, qrPng: composedPng });
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });
  await prisma.seatHold.deleteMany({ where: { userId: order.userId, eventId: order.eventId } });

  try {
    await sendTicketsEmail({
      to: order.user.email,
      customerName: order.user.name ?? null,
      orderId: order.id,
      eventName: order.event.name,
      eventDate: order.event.date,
      venueName: order.event.venue.name,
      tickets: emailTickets, // filenames los pones en mail.ts con seatLabel
    });
  } catch (err) {
    console.error("Email error:", err);
  }

  return Response.json({ ok: true, status: "PAID", finalized: true });
}
