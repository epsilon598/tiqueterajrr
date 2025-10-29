import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

// Esquema de validación (Zod)
const RegisterSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(100, "Nombre demasiado largo"),
  email: z.string().email("Email inválido").toLowerCase().trim(),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .max(72, "La contraseña es demasiado larga"),
});

export async function POST(req: Request) {
  try {
    // Asegura Content-Type correcto
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type inválido" }, { status: 400 });
    }

    // Lee y valida el payload
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues?.[0];
      return NextResponse.json({ error: first?.message ?? "Datos inválidos" }, { status: 400 });
    }
    const { name, email, password } = parsed.data;

    // ¿ya existe el email?
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crea el usuario
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        provider: "credentials", // importante para permitir login con usuario/contraseña
        // role: "USER", // si tu schema tiene Role y default, no hace falta
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    // Errores de Prisma (únicos, etc.)
    const e = err as any;
    if (e?.code === "P2002") {
      // unique constraint
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 });
    }

    console.error("REGISTER ERROR:", err);
    return NextResponse.json({ error: "Error inesperado en el registro" }, { status: 500 });
  }
}
