import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function assertAdmin(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!u || u.role !== "ADMIN") throw new Error("FORBIDDEN");
}

type Body = { qr: string };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return new Response("Unauthorized", { status: 401 });

  try {
    await assertAdmin(session.userId);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const { qr } = (await req.json().catch(() => ({}))) as Body;
  if (!qr || typeof qr !== "string") {
    return new Response(JSON.stringify({ error: "QR inválido" }), { status: 400 });
  }

  // Formato que generamos: TICKET:<orderId>:<seatId>:<uuid>
  if (!qr.startsWith("TICKET")) {
    return new Response(JSON.stringify({ error: "Formato QR desconocido" }), { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { qrCodeValue: qr },
    include: {
      order: { include: { event: { include: { venue: true } } } },
      seat: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!ticket) {
    return new Response(JSON.stringify({ ok: false, status: "NOT_FOUND" }), { status: 404 });
  }

  if (ticket.status === "USED") {
    return Response.json({
      ok: true,
      status: "ALREADY_USED",
      usedAt: ticket.usedAt,
      info: {
        event: ticket.order.event.name,
        seat: ticket.seat.label,
        holder: ticket.user?.email ?? "",
      },
    });
  }

  // Marcar uso
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "USED", usedAt: new Date() },
    include: {
      order: { include: { event: true } },
      seat: true,
      user: { select: { email: true, name: true } },
    },
  });

  return Response.json({
    ok: true,
    status: "JUST_USED",
    info: {
      event: updated.order.event.name,
      seat: updated.seat.label,
      holder: updated.user?.email ?? "",
      when: updated.usedAt,
    },
  });
}
