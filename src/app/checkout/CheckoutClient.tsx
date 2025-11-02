// src/app/checkout/CheckoutClient.tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

interface Props {
  isAdmin: boolean;
}

export default function CheckoutClient({ isAdmin }: Props) {
  const search = useSearchParams();
  const orderId = search.get("orderId");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ ticketId: string; png: string; filename: string }[]>([]);

  async function payWompi() {
    if (!orderId) return setMsg("Falta el orderId");
    setMsg(null);
    setImages([]);
    setLoading(true);

    try {
      const res = await fetch("/api/pay/wompi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({} as any));
      setLoading(false);

      if (!res.ok || !data?.url) {
        setMsg(data?.error || "Error al iniciar el pago con Wompi.");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error("Error al iniciar Wompi:", err);
      setMsg("Error inesperado al iniciar el pago con Wompi.");
      setLoading(false);
    }
  }

  async function paySimulado() {
    if (!orderId) return setMsg("Falta el orderId");
    setMsg(null);
    setImages([]);
    setLoading(true);

    try {
      const res = await fetch("/api/pay/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({} as any));
      setLoading(false);

      if (!res.ok || !data.ok) {
        setMsg(data.error || "Error al procesar el pago.");
        return;
      }

      const imgs = Array.isArray(data.images) ? data.images : [];
      setMsg(`✅ Pago OK. Tickets emitidos: ${imgs.length}`);
      if (imgs.length > 0) setImages(imgs);
    } catch (err) {
      console.error("Error al pagar:", err);
      setMsg("Error inesperado al procesar el pago.");
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">Checkout</h1>
      <p>Orden: {orderId}</p>

      <div className="flex gap-2 mt-3">
        {/* 💳 Pago real con Wompi */}
        <button
          disabled={loading}
          onClick={payWompi}
          className="border px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          title="Redirige al portal seguro de Wompi"
        >
          {loading ? "Procesando..." : "💳 Pagar con Wompi"}
        </button>

        {/* 🧪 Solo visible si es admin */}
        {isAdmin && (
          <button
            disabled={loading}
            onClick={paySimulado}
            className="border px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? "Procesando..." : "🧪 Pagar (simulado)"}
          </button>
        )}
      </div>

      {/* Mensaje de estado */}
      {msg && <p className="mt-3">{msg}</p>}

      {/* Sección de imágenes (simulado) */}
      {images.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold mb-2">🎟️ Tus tickets</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img) => (
              <div key={img.ticketId} className="border rounded p-2 text-center">
                <Image
                  src={img.png}
                  alt={`Ticket ${img.filename}`}
                  width={512}
                  height={512}
                  className="w-full h-auto mb-2 border rounded"
                />
                <a href={img.png} download={img.filename} className="text-sm underline text-blue-600">
                  Descargar {img.filename}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p>
          Con <b>Wompi</b> serás redirigid@ a su portal seguro. Al aprobarse el pago, tus boletos se emiten
          automáticamente y llegan por email.
        </p>
        {isAdmin && <p className="text-blue-500 mt-1">🧪 Pago simulado disponible solo para administradores.</p>}
      </div>
    </div>
  );
}
