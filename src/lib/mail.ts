// src/lib/mail.ts
import nodemailer from "nodemailer";

function boolFromEnv(v: string | undefined, def = false) {
  if (v == null) return def;
  return ["1","true","yes","on"].includes(v.toLowerCase());
}

export function createTransport() {
  const host = process.env.SMTP_HOST!;
  const port = Number(process.env.SMTP_PORT || "465");
  const secure =
    boolFromEnv(process.env.SMTP_SECURE, port === 465) || port === 465; // true para 465 (SSL), false para 587 (STARTTLS)
  const user = process.env.SMTP_USER!;
  const pass = process.env.SMTP_PASS!;

  if (!host || !user || !pass) {
    throw new Error("SMTP no configurado. Revisa .env (SMTP_HOST/PORT/SECURE/USER/PASS).");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,                 // 465 => true (SSL directo), 587 => false (STARTTLS)
    auth: { user, pass },
    requireTLS: !secure,    // fuerza STARTTLS cuando secure=false
    tls: {
      minVersion: "TLSv1.2",
    },
    // logger: true, debug: true, // activa si quieres ver más logs
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

  const attachments: TicketAttachment[] = opts.tickets.map((t, i) => ({
    filename: `ticket-${i + 1}-${opts.orderId}.png`,
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

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: `Tus tickets: ${opts.eventName} — Orden ${opts.orderId}`,
    html,
    attachments,
  });
}
