"use client";

import Image from "next/image";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function CheckoutPage() {
  const search = useSearchParams();
  const orderId = search.get("orderId");

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ ticketId: string; png: string; filename: string }[]>([]);

  // 🔵 NUEVO: pagar con Wompi (sandbox)
  async function payWompi() {
    if (!orderId) {
      setMsg("Falta el orderId");
      return;
    }
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

      // Redirige al checkout de Wompi
      window.location.href = data.url;
    } catch (err) {
      console.error("Error al iniciar Wompi:", err);
      setMsg("Error inesperado al iniciar el pago con Wompi.");
      setLoading(false);
    }
  }

  // (opcional) sigue aquí el flujo simulado por si quieres mantenerlo
  async function pay() {
    if (!orderId) {
      setMsg("Falta el orderId");
      return;
    }

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

      // Compatibilidad con ambos formatos del backend
      const imgs = Array.isArray(data.images) ? data.images : [];
      const count =
        imgs.length ??
        (Array.isArray(data.tickets) ? data.tickets.length : typeof data.count === "number" ? data.count : 0);

      setMsg(`✅ Pago OK. Tickets emitidos: ${count}.`);
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
        {/* 🔵 NUEVO: botón Wompi */}
        <button
          disabled={loading}
          onClick={payWompi}
          className="border px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          title="Redirige al portal seguro de Wompi (sandbox)"
        >
          {loading ? "Procesando..." : "💳 Pagar con Wompi (sandbox)"}
        </button>

        {/* (Opcional) Botón de pago simulado anterior */}
        <button
          disabled={loading}
          onClick={pay}
          className="border px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {loading ? "Procesando..." : "🧪 Pagar (simulado)"}
        </button>
      </div>

      {/* Mensaje de estado */}
      {msg && <p className="mt-3">{msg}</p>}

      {/* Sección de imágenes solo aplica al flujo simulado */}
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

      {/* Nota para el usuario cuando use Wompi */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          Con <b>Wompi</b> serás redirigid@ a su portal seguro. Al aprobarse el pago, Wompi envía un{" "}
          <i>webhook</i> a nuestra app y tus boletos se emiten automáticamente (y se envían por email).
        </p>
      </div>
    </div>
  );
}
