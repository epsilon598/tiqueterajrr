// src/app/api/dev/test-mail/route.ts
import { createTransport } from "@/lib/mail";

export async function POST() {
  try {
    const transporter = createTransport();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER!,
      to: process.env.SMTP_USER!, // cámbialo si quieres
      subject: "Prueba SMTP ✅",
      text: "Hola, este es un test de SMTP desde Tiquetera.",
    });
    return new Response("ok", { status: 200 });
  } catch (e: any) {
    console.error("SMTP test error:", e);
    return new Response(`error: ${e?.message || "smtp error"}`, { status: 500 });
  }
}
