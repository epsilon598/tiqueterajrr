// src/lib/tickets.ts
import { prisma } from "./prisma";
import QRCode from "qrcode";

export async function getEventWithVenue(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: { include: { seats: true } } },
  });
}

// 🔹 Asegurar CENTAVOS con heurística
export function priceForSeat(
  event: { basePrice: number; ivaRate: number },
  seat: { priceOverride: number | null }
) {
  const rawBase = Number(event.basePrice ?? 0);
  const baseCents = rawBase < 100000 ? rawBase * 100 : rawBase;

  const rawOverride = seat.priceOverride == null ? null : Number(seat.priceOverride);
  const overrideCents = rawOverride == null ? null : rawOverride < 100000 ? rawOverride * 100 : rawOverride;

  const price = Number(overrideCents ?? baseCents); // CENTAVOS
  const iva = Math.round(price + Number(event.ivaRate ?? 0));
  return { price, iva, total: price + iva };
}

export async function getUnavailableSeatIds(eventId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { eventId, status: { in: ["ISSUED", "USED"] } },
    select: { seatId: true },
  });

  const now = new Date();
  const holds = await prisma.seatHold.findMany({
    where: { eventId, expiresAt: { gt: now } },
    select: { seatId: true },
  });

  const set = new Set<string>();
  tickets.forEach((t) => set.add(t.seatId));
  holds.forEach((h) => set.add(h.seatId));
  return set;
}

export async function generateQRDataURL(value: string) {
  return QRCode.toDataURL(value, { errorCorrectionLevel: "M" });
}
