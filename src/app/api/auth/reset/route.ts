import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string" || !password || typeof password !== "string") {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const t = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!t || t.used || t.expiresAt <= new Date()) {
    return Response.json({ error: "Token inválido o expirado." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: t.userId },
      data: { passwordHash: hash },
    }),
    prisma.passwordResetToken.update({
      where: { id: t.id },
      data: { used: true },
    }),
  ]);

  return Response.json({ ok: true });
}
