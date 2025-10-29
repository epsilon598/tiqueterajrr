// src/lib/qrImage.ts
import sharp from "sharp";

/**
 * Compone un PNG con el QR (arriba) y el texto del asiento centrado debajo.
 * @param seatLabel Etiqueta del asiento (ej: "A-12")
 * @param qrPng Buffer PNG del QR (por ejemplo generado con `qrcode.toBuffer`)
 */
export async function composeQrWithSeatLabel(seatLabel: string, qrPng: Buffer): Promise<Buffer> {
  const qr = sharp(qrPng);
  const meta = await qr.metadata();

  // Ancho/alto del PNG original del QR (con fallback)
  const qrW = meta.width ?? 256;
  const qrH = meta.height ?? 256;

  const padding = 20;
  const textHeight = 40;

  // SVG con el texto centrado
  const svg = Buffer.from(
    `<svg width="${qrW}" height="${textHeight}" xmlns="http://www.w3.org/2000/svg">
       <rect width="100%" height="100%" fill="#FFFFFF"/>
       <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
             font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#000000">
         ${escapeHtml(seatLabel)}
       </text>
     </svg>`
  );

  // Lienzo base blanco
  const outW = qrW + padding * 2;
  const outH = qrH + padding * 3 + textHeight;

  const base = sharp({
    create: {
      width: outW,
      height: outH,
      channels: 3,
      background: "#FFFFFF",
    },
  });

  const out = await base
    .composite([
      // QR arriba
      { input: await qr.toBuffer(), left: padding, top: padding },
      // Texto debajo del QR
      { input: svg, left: padding, top: padding * 2 + qrH },
    ])
    .png()
    .toBuffer();

  return out;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));
}
