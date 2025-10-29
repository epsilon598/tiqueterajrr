import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return new Response("Unauthorized", { status: 401 });

  // Verifica rol admin
  const me = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!me || me.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const { qrCodeValue } = await req.json() as { qrCodeValue: string };
  if (!qrCodeValue) return new Response("Invalid payload", { status: 400 });

  const ticket = await prisma.ticket.findUnique({ where: { qrCodeValue } });
  if (!ticket) return new Response(JSON.stringify({ ok: false, reason: "NOT_FOUND" }), { status: 404 });

  if (ticket.status === "USED") {
    return Response.json({ ok: false, reason: "ALREADY_USED", usedAt: ticket.usedAt });
  }

  if (ticket.status !== "ISSUED") {
    return Response.json({ ok: false, reason: `INVALID_STATUS_${ticket.status}` });
  }

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "USED", usedAt: new Date() },
  });

  return Response.json({ ok: true, ticketId: updated.id, usedAt: updated.usedAt });
}
