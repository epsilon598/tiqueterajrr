import { prisma } from "./prisma";
import QRCode from "qrcode";

export async function getEventWithVenue(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: { include: { seats: true } } },
  });
}

export function priceForSeat(event: { basePrice: number; ivaRate: number }, seat: { priceOverride: number | null }) {
  const price = seat.priceOverride ?? event.basePrice;
  const iva = Math.round(price * event.ivaRate);
  return { price, iva, total: price + iva };
}

// Asientos ocupados: tickets emitidos no cancelados (eventId, seatId) + holds no expirados
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
  tickets.forEach(t => set.add(t.seatId));
  holds.forEach(h => set.add(h.seatId));

  return set; // Set de seatId ocupados/bloqueados
}

// Genera QR DataURL a partir de un valor único
export async function generateQRDataURL(value: string) {
  return QRCode.toDataURL(value, { errorCorrectionLevel: "M" });
}
