// src/app/checkout/confirm/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type OrderStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

type EventDTO = { id?: string; name: string };
type OrderDTO = {
  id: string;
  status: OrderStatus;
  total: number;
  event?: EventDTO | null;
};

// --- Type guards sin `any` ---
function hasName(x: unknown): x is { name: string } {
  return typeof x === "object" && x !== null && "name" in x && typeof (x as { name: unknown }).name === "string";
}
function isOrderDTO(x: unknown): x is OrderDTO {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Partial<OrderDTO>;
  const statusOk =
    o.status === "PENDING" || o.status === "PAID" || o.status === "FAILED" || o.status === "CANCELLED";
  const eventOk = o.event == null || (typeof o.event === "object" && o.event !== null && hasName(o.event));
  return typeof o.id === "string" && typeof o.total === "number" && statusOk && eventOk;
}

type ConfirmResp = { ok?: boolean; status?: OrderStatus; finalized?: boolean };

export default function CheckoutConfirmPage() {
  const search = useSearchParams();
  const orderId = search.get("orderId");
  const wompiId = search.get("id");
  const env = search.get("env") ?? "sandbox";

  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [msg, setMsg] = useState<string>("Confirmando tu pago…");

  const pollCountRef = useRef(0);
  const triedConfirmRef = useRef(false);

  const canPoll = useMemo(() => Boolean(orderId), [orderId]);

  async function fetchOrder() {
    if (!orderId) return;
    const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    if (!res.ok) return;

    const raw: unknown = await res.json();
    if (!isOrderDTO(raw)) return;

    const data = raw; // data: OrderDTO
    setOrder(data);

    switch (data.status) {
      case "PAID":
        setMsg("✅ Pago aprobado. Tus boletos fueron enviados a tu correo.");
        break;
      case "FAILED":
        // 🔴 Ya NO sugerimos reintentar pagar aquí
        setMsg("❌ Pago rechazado por el banco.");
        break;
      case "PENDING":
        setMsg("⌛ Pago pendiente. Aguardando confirmación de Wompi…");
        break;
      default:
        setMsg("❌ Orden cancelada o inválida.");
    }
  }

  // 🔁 Polling del estado
  useEffect(() => {
    if (!canPoll) return;

    fetchOrder();

    const i = setInterval(() => {
      const st = (order?.status ?? "PENDING") as OrderStatus;
      if (st === "PAID" || st === "FAILED") {
        clearInterval(i);
        return;
      }
      if (pollCountRef.current >= 20) {
        clearInterval(i);
        setMsg(
          st === "PAID"
            ? "✅ Pago aprobado."
            : "⏱️ No se recibió confirmación aún. Si ya pagaste, revisa tu correo o vuelve en un momento."
        );
        return;
      }
      pollCountRef.current += 1;
      void fetchOrder();
    }, 3000);

    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPoll, order?.status]);

  // 🛟 Fallback: consultar Wompi una sola vez si sigue PENDING
  useEffect(() => {
    async function tryConfirmOnce() {
      if (triedConfirmRef.current) return;
      if (!orderId || !wompiId) return;

      const st = (order?.status ?? "PENDING") as OrderStatus;
      if (st === "PAID" || st === "FAILED") return;

      triedConfirmRef.current = true;
      setMsg("⌛ Verificando con Wompi…");

      try {
        const res = await fetch("/api/wompi/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, transactionId: wompiId }),
        });

        const data: ConfirmResp = await res.json().catch(() => ({} as ConfirmResp));
        if (res.ok && (data.status === "PAID" || data.status === "FAILED")) {
          await fetchOrder();
          return;
        }
        setMsg("⌛ Pago pendiente. Aguardando confirmación de Wompi…");
      } catch {
        setMsg("⌛ Pago pendiente. Aguardando confirmación de Wompi…");
      }
    }

    const t = setTimeout(() => {
      const st = (order?.status ?? "PENDING") as OrderStatus;
      if (st === "PENDING") void tryConfirmOnce();
    }, 2000);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, wompiId, order?.status]);

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-semibold mb-2">Confirmación de pago</h1>

      <div className="text-sm text-gray-700 space-y-1 mb-4">
        <div><b>OrderId:</b> {orderId ?? "-"}</div>
        <div><b>Wompi Id:</b> {wompiId ?? "-"}</div>
        <div><b>Ambiente:</b> {env}</div>
      </div>

      <p className="mb-4">{msg}</p>

      {order && (
        <div className="border rounded p-4">
          <div className="mb-1"><b>Evento:</b> {order.event?.name ?? "-"}</div>
          <div className="mb-1"><b>Total:</b> ${(order.total / 100).toLocaleString()}</div>
          <div><b>Estado:</b> {order.status}</div>
        </div>
      )}

      {/* 🔴 Sin botón de reintento cuando es FAILED */}
      {order?.status === "FAILED" && (
        <div className="mt-4">
          <p className="text-sm mb-2">El intento de pago fue declinado.</p>
          <Link href="/" className="underline text-blue-600">Volver al inicio</Link>
        </div>
      )}

      <Link href="/" className="inline-block mt-6 underline text-blue-600">
        Volver al inicio
      </Link>
    </div>
  );
}
