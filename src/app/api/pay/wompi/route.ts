// src/app/api/pay/wompi/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return new Response("Unauthorized", { status: 401 });

  const { orderId } = await req.json().catch(() => ({} as any));
  if (!orderId) return new Response("Invalid payload", { status: 400 });

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { event: true },
  });
  if (!order || order.userId !== session.userId)
    return new Response("Not found", { status: 404 });
  if (order.status !== "PENDING")
    return new Response("Order not pending", { status: 400 });

  // ⚠️ Asegurar número (Prisma Decimal -> number)
  let amountInCents = Number(order.total);
  if (Number.isFinite(amountInCents) && amountInCents > 0 && amountInCents < 1000) {
    amountInCents = Math.round(amountInCents * 100);
  }

  const currency = "COP";
  const reference = order.id;

  // ✅ Limpieza de variables de entorno
  const integrityKey = (process.env.WOMPI_INTEGRITY_KEY || "").trim();
  const publicKey = (process.env.WOMPI_PUBLIC_KEY || "").trim();
  const redirectUrl = `${(process.env.NEXTAUTH_URL || "").replace(/\/+$/, "")}/checkout/confirm?orderId=${order.id}`;

  if (!integrityKey || !publicKey) {
    return new Response("Wompi not configured (missing INTEGRITY or PUBLIC key)", {
      status: 500,
    });
  }
  if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
    return new Response("Invalid amount_in_cents", { status: 500 });
  }

  // ✅ Firma de integridad EXACTA
  const preimage = `${reference}${amountInCents}${currency}${integrityKey}`;
  const signature = createHash("sha256").update(preimage).digest("hex");

  // 🧩 Log opcional (puedes borrar en producción)
  console.log("🔏 Generando firma Wompi:");
  console.log("Preimage:", preimage);
  console.log("Signature:", signature);
  console.log("Amount in cents:", amountInCents);

  // URL de Checkout Web
  const params = new URLSearchParams();
  params.set("public-key", publicKey);
  params.set("currency", currency);
  params.set("amount-in-cents", String(Math.round(amountInCents)));
  params.set("reference", reference);
  params.set("redirect-url", redirectUrl);
  params.set("signature:integrity", signature); // (se codifica como signature%3Aintegrity)

  const checkoutUrl = `https://checkout.wompi.co/p/?${params.toString()}`;

  return Response.json({ ok: true, url: checkoutUrl });
}
