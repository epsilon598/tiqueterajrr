import { prisma } from "@/lib/prisma";
import { composeQrWithSeatLabel } from "@/lib/qrImage";
import QRCode from "qrcode";
import nodemailer from "nodemailer";

// ⚠️ Asegura que sea Node.js (no Edge), por sharp/nodemailer
export const runtime = "nodejs";

type MailEnv = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
};

function getMailEnv(): MailEnv {
  return {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
  };
}

function canSendMail(env: MailEnv) {
  return !!(env.host && env.port && env.user && env.pass && env.from);
}

export async function POST(req: Request) {
  try {
    const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId requerido" }), { status: 400 });
    }

    // 1) Traer orden con todo lo necesario
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        event: { select: { id: true, name: true, date: true } },
        tickets: {
          include: {
            seat: { select: { id: true, label: true } },
          },
        },
      },
    });

    if (!order) {
      return new Response(JSON.stringify({ error: "Orden no encontrada" }), { status: 404 });
    }

    if (!order.tickets || order.tickets.length === 0) {
      return new Response(JSON.stringify({ error: "La orden no tiene tickets" }), { status: 400 });
    }

    // 2) Generar PNG del QR + composición con etiqueta del asiento
    const outputs: { ticketId: string; png: string; filename: string }[] = [];

    for (const t of order.tickets) {
      // Si por algún motivo no hay qrCodeValue, generamos uno
      const qrValue = t.qrCodeValue || cryptoRandomUUID();
      // Asegurarnos de persistirlo si no existía
      if (!t.qrCodeValue) {
        await prisma.ticket.update({
          where: { id: t.id },
          data: { qrCodeValue: qrValue },
        });
      }

      // PNG del QR
      const qrPng = await QRCode.toBuffer(qrValue, { type: "png", width: 512 });
      // Componer imagen con texto del asiento (A-12, etc.)
      const composed = await composeQrWithSeatLabel(t.seat.label, qrPng);

      const base64 = Buffer.from(composed).toString("base64");
      outputs.push({
        ticketId: t.id,
        png: `data:image/png;base64,${base64}`,
        filename: `ticket-${t.seat.label}.png`,
      });
    }

    // 3) Marcar orden como PAGADA (simulación de gateway)
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID", paymentRef: `SIM-${Date.now()}` },
    });

    // 4) (Opcional) Enviar email con los tickets adjuntos
    const env = getMailEnv();
    if (canSendMail(env) && order.user?.email) {
      const transporter = nodemailer.createTransport({
        host: env.host!,
        port: env.port!,
        secure: env.port === 465, // típico para 465
        auth: { user: env.user!, pass: env.pass! },
      });

      const attachments = outputs.map((o) => ({
        filename: o.filename,
        content: Buffer.from(o.png.split(",")[1], "base64"),
        contentType: "image/png",
      }));

      const fecha = order.event?.date
        ? new Date(order.event.date).toLocaleString("es-CO")
        : "";

      await transporter.sendMail({
        from: env.from!,
        to: order.user.email,
        subject: `Tus tickets – ${order.event?.name ?? "Evento"}`,
        html: `
          <p>Hola ${order.user.name ?? ""},</p>
          <p>¡Pago confirmado! Adjuntamos tus tickets para <b>${order.event?.name ?? "el evento"}</b>
          ${fecha ? ` el <b>${fecha}</b>` : ""}.</p>
          <p>Puedes presentar el QR en la entrada.</p>
          <p>Gracias por tu compra.</p>
        `,
        attachments,
      });
    }

    // 5) Responder al cliente
    return Response.json({
      ok: true,
      count: outputs.length,
      images: outputs, // [{ ticketId, png, filename }]
      tickets: outputs, // ← agregado para compatibilidad con tu frontend actual
    });
  } catch (e) {
    console.error("PAY_SIMULATE ERROR:", e);
    return new Response(JSON.stringify({ error: "Error procesando pago simulado" }), { status: 500 });
  }
}

// Pequeño helper por si el runtime no expone global crypto.randomUUID
function cryptoRandomUUID() {
  if (typeof (globalThis as any).crypto?.randomUUID === "function") {
    return (globalThis as any).crypto.randomUUID();
  }
  const rnd = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}
