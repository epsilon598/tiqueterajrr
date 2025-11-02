// src/app/api/holds/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const HOLD_MINUTES = 10;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return new Response("Unauthorized", { status: 401 });
  const userId: string = session.userId;

  const body = await req.json().catch(() => null);
  const eventId = body?.eventId as string | undefined;
  const seatIds = (body?.seatIds as string[] | undefined) ?? [];
  if (!eventId || seatIds.length === 0) {
    return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
  }

  const now = new Date();
  const newExpiry = new Date(now.getTime() + HOLD_MINUTES * 60_000);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Limpia expirados del evento
      await tx.seatHold.deleteMany({
        where: { eventId, expiresAt: { lte: now } },
      });

      // Revisa ocupados vigentes
      const existing = await tx.seatHold.findMany({
        where: { eventId, seatId: { in: seatIds }, expiresAt: { gt: now } },
        select: { seatId: true, userId: true },
      });

      const heldByOthers = existing.filter(e => e.userId !== userId).map(e => e.seatId);
      const heldByMe = existing.filter(e => e.userId === userId).map(e => e.seatId);

      if (heldByOthers.length > 0) {
        return { conflict: true, heldByOthers, renewed: [], created: [] };
      }

      // Idempotencia: renueva los míos
      if (heldByMe.length > 0) {
        await tx.seatHold.updateMany({
          where: { userId, eventId, seatId: { in: heldByMe }, expiresAt: { gt: now } },
          data: { expiresAt: newExpiry },
        });
      }

      // Crear los que faltan (a prueba de carrera con @@unique)
      const toCreate = seatIds.filter((id) => !heldByMe.includes(id));
      const created: string[] = [];
      for (const seatId of toCreate) {
        try {
          await tx.seatHold.create({
            data: { userId, eventId, seatId, expiresAt: newExpiry },
          });
          created.push(seatId);
        } catch (e: any) {
          // Si alguien se te adelantó: P2002
          if (e?.code === "P2002") {
            return { conflict: true, heldByOthers: [seatId], renewed: heldByMe, created };
          }
          throw e;
        }
      }

      return { conflict: false, heldByOthers: [], renewed: heldByMe, created };
    });

    if (result.conflict) {
      return new Response(
        JSON.stringify({ error: "Alguno de los asientos ya fue apartado.", occupied: result.heldByOthers }),
        { status: 409 }
      );
    }

    return Response.json({
      ok: true,
      expiresAt: newExpiry,
      renewed: result.renewed,
      created: result.created,
      holdMinutes: HOLD_MINUTES,
    });
  } catch (err) {
    console.error("[/api/holds] error:", err);
    return new Response(JSON.stringify({ error: "No se pudieron apartar los asientos." }), { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => null);
  const eventId = body?.eventId as string | undefined;
  const seatIds = (body?.seatIds as string[] | undefined) ?? [];
  if (!eventId || seatIds.length === 0) {
    return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400 });
  }

  await prisma.seatHold.deleteMany({
    where: { userId: session.userId, eventId, seatId: { in: seatIds } },
  });

  return Response.json({ ok: true });
}
