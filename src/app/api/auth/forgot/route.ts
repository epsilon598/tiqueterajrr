import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";
import crypto from "crypto";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return new Response("Invalid payload", { status: 400 });
  }

  // Siempre respondemos 200 para no filtrar existencia
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Limpia tokens viejos del usuario
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, OR: [{ used: true }, { expiresAt: { lt: new Date() } }] },
      });

      const token = crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt, used: false },
      });

      const base =
        process.env.NEXTAUTH_URL ||
        process.env.PUBLIC_URL ||
        `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
      const resetLink = `${base}/auth/reset?token=${encodeURIComponent(token)}`;

      await sendPasswordResetEmail({ to: email, resetLink });
    }
  } catch (e) {
    // no revelamos detalle al cliente
  }

  return Response.json({ ok: true });
}
