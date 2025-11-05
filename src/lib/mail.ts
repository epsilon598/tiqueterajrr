import nodemailer from "nodemailer";

function boolFromEnv(v: string | undefined, def = false) {
  if (v == null) return def;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

function safeFilename(s: string): string {
  return (s || "file")
    .normalize("NFKD")
    .replace(/[^\w\s.-]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

export function createTransport() {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || "465");
  const secure =
    boolFromEnv(process.env.SMTP_SECURE, port === 465) || port === 465;
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;

  if (!host || !user || !pass) {
    throw new Error("SMTP no configurado. Revisa .env (SMTP_HOST/PORT/SECURE/USER/PASS).");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure, // 465 => true (SSL directo), 587 => false (STARTTLS)
    auth: { user, pass },
    requireTLS: !secure,
    tls: { minVersion: "TLSv1.2" },
  });
}

export type TicketAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
};

export async function sendTicketsEmail(opts: {
  to: string;
  customerName?: string | null;
  orderId: string;
  eventName: string;
  eventDate: Date;
  venueName: string;
  tickets: { seatLabel: string; qrPng: Buffer }[];
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const transporter = createTransport();

  // ✅ Nombre del evento + asiento
  const attachments: TicketAttachment[] = opts.tickets.map((t) => ({
    filename: `${safeFilename(opts.eventName)}_${safeFilename(t.seatLabel)}.png`,
    content: t.qrPng,
    contentType: "image/png",
  }));

  const totalTickets = opts.tickets.length;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4">
    <h2>¡Gracias por tu compra!</h2>
    <p>Hola ${opts.customerName ?? ""}, tu orden <b>${opts.orderId}</b> del evento <b>${opts.eventName}</b> fue confirmada.</p>
    <p><b>Fecha:</b> ${new Date(opts.eventDate).toLocaleString()}</p>
    <p><b>Lugar:</b> ${opts.venueName}</p>
    <p>Adjuntamos ${totalTickets} ticket(s) con su código QR.</p>
    <h3>Asientos</h3>
    <ul>
      ${opts.tickets.map((t) => `<li>${t.seatLabel}</li>`).join("")}
    </ul>
    <p>Presenta el QR en el acceso para validar tu entrada.</p>
    <hr/>
    <p style="color:#666">Tiquetera Virtual</p>
  </div>
  `;
  console.log(`From ${from} to:${opts.to}`)
  await transporter.sendMail({
    from,
    to: opts.to,
    subject: `Tus tickets: ${opts.eventName} — Orden ${opts.orderId}`,
    html,
    attachments,
  });
  console.log("Enviado")
}

/* ✅ NUEVO: Email de restablecimiento de contraseña */
export async function sendPasswordResetEmail(opts: {
  to: string;
  resetLink: string; // URL completa a /auth/reset?token=...
}) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const transporter = createTransport();

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.4">
    <h2>Restablecer contraseña</h2>
    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
    <p>Haz clic en el siguiente enlace (válido por 30 minutos):</p>
    <p><a href="${opts.resetLink}" style="color:#1a73e8;">${opts.resetLink}</a></p>
    <p>Si no solicitaste esto, puedes ignorar este mensaje.</p>
    <hr/>
    <p style="color:#666">Tiquetera Virtual</p>
  </div>
  `;

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: "Restablece tu contraseña",
    html,
  });
}
