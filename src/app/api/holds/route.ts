// src/app/api/holds/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
const HOLD_MINUTES = 10;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return new Response("Unauthorized", { status: 401 });

  // 👇 estrechamos tipo para TS (ya pasamos el guard)
  const userId: string = session.userId;

  const body = await req.json().catch(() => null);
  const eventId = body?.eventId as string | undefined;
  const seatIds = (body?.seatIds as string[] | undefined) ?? [];
  if (!eventId || seatIds.length === 0) {
    return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
  }

  // Limpieza de holds vencidos (opcional)
  await prisma.seatHold.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { venue: true },
  });
  if (!event) {
    return new Response(JSON.stringify({ error: "Evento no encontrado" }), { status: 404 });
  }

  const now = new Date();
  const newExpiry = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);

  // Busca holds vigentes para los seatIds solicitados
  const existing = await prisma.seatHold.findMany({
    where: { eventId, seatId: { in: seatIds }, expiresAt: { gt: now } },
    select: { seatId: true, userId: true },
  });

  const heldByOthers = existing.filter((e) => e.userId !== userId).map((e) => e.seatId);
  const heldByMe = existing.filter((e) => e.userId === userId).map((e) => e.seatId);

  if (heldByOthers.length > 0) {
    return new Response(
      JSON.stringify({
        error: "Uno o más asientos ya están apartados.",
        occupied: heldByOthers,
      }),
      { status: 409 }
    );
  }

  // Solo crear para los que no existen aún como hold
  const existingSeatIds = new Set(existing.map((e) => e.seatId));
  const toCreate = seatIds.filter((id) => !existingSeatIds.has(id));

  // Límite por usuario: solo si el evento define maxPerUser
  const maxPerUser = event.maxPerUser; // number | null
  if (maxPerUser != null) {
    const myActiveHoldsCount = await prisma.seatHold.count({
      where: { userId, eventId, expiresAt: { gt: now } },
    });
    const myTicketsCount = await prisma.ticket.count({
      where: { userId, eventId, status: { in: ["ISSUED", "USED"] } },
    });

    const wouldBeTotal = myActiveHoldsCount + toCreate.length + myTicketsCount;
    if (wouldBeTotal > maxPerUser) {
      const remaining = Math.max(0, maxPerUser - (myActiveHoldsCount + myTicketsCount));
      return new Response(
        JSON.stringify({
          error: `Límite por usuario (${maxPerUser}) excedido. Te quedan ${remaining}.`,
        }),
        { status: 409 }
      );
    }
  }

  // Idempotencia: renueva expiración de los que ya eran tuyos
  if (heldByMe.length > 0) {
    await prisma.seatHold.updateMany({
      where: { userId, eventId, seatId: { in: heldByMe }, expiresAt: { gt: now } },
      data: { expiresAt: newExpiry },
    });
  }

  // Crear holds nuevos
  if (toCreate.length > 0) {
    await prisma.seatHold.createMany({
      data: toCreate.map((seatId) => ({
        userId,        // 👈 ahora es string, no 'string | undefined'
        eventId,
        seatId,
        expiresAt: newExpiry,
      })),
    });
  }

  return Response.json({
    ok: true,
    expiresAt: newExpiry,
    renewed: heldByMe,
    created: toCreate,
    holdMinutes: HOLD_MINUTES,
  });
}
