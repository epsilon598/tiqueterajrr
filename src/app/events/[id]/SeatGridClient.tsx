"use client";

import { useMemo, useState, useEffect, useRef } from "react"; // ⏱️ TIMER: useEffect y useRef
import { useRouter } from "next/navigation";

export type SeatItem = {
  id: string;
  row: number;
  col: number;
  label: string;
  price: number; // centavos
  iva: number;   // centavos
  total: number; // centavos
  available: boolean;
};

interface SeatGridClientProps {
  eventId: string;
  rows: number;
  cols: number;
  seats: SeatItem[];
}

export default function SeatGridClient({ eventId, rows, cols, seats }: SeatGridClientProps) {
  const router = useRouter();

  // mapa posición -> asiento
  const byPos = useMemo(() => {
    const map = new Map<string, SeatItem>();
    seats.forEach((s) => map.set(`${s.row}-${s.col}`, s));
    return map;
  }, [seats]);

  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingHold, setLoadingHold] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [holdOk, setHoldOk] = useState(false); // habilita el botón de checkout tras apartar

  // ⏱️ TIMER: estado y utilidades
  const [expiresAt, setExpiresAt] = useState<string | null>(null); // ISO que devuelve la API
  const [timeLeft, setTimeLeft] = useState<string>("");            // mm:ss
  const timerRef = useRef<NodeJS.Timeout | null>(null);            // id del intervalo

  // ⏱️ TIMER: formatear mm:ss
  function formatCountdown(targetISO: string) {
    const target = new Date(targetISO).getTime();
    const diff = target - Date.now();
    if (diff <= 0) return "00:00";
    const s = Math.floor(diff / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // ⏱️ TIMER: arrancar y parar intervalo
  function startTimer(targetISO: string) {
    stopTimer();
    setTimeLeft(formatCountdown(targetISO));
    timerRef.current = setInterval(() => {
      const left = formatCountdown(targetISO);
      setTimeLeft(left);
      if (left === "00:00") {
        stopTimer();
        void onExpire();
      }
    }, 1000);
  }
  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // ⏱️ TIMER: al expirar — liberar holds, limpiar selección y refrescar
  async function onExpire() {
    setMessage("Tiempo agotado. Liberando asientos…");
    try {
      if (selected.length > 0) {
        await fetch("/api/holds", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ eventId, seatIds: selected }),
        });
      }
    } catch {
      // ignoramos errores puntuales de red
    } finally {
      setSelected([]);
      setHoldOk(false);
      setExpiresAt(null);
      setTimeLeft("");
      setMessage("Se liberaron los asientos por tiempo agotado.");
      router.refresh(); // refrescar disponibilidad
    }
  }

  function toggleSeat(s?: SeatItem) {
    if (!s || !s.available) return;
    setHoldOk(false); // si cambias selección, exige volver a apartar
    setSelected((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]));
  }

  const selectedSeats = useMemo(() => seats.filter((s) => selected.includes(s.id)), [seats, selected]);
  const selectedTotal = useMemo(() => selectedSeats.reduce((acc, s) => acc + s.total, 0), [selectedSeats]);

  // 1) APARTAR
  async function apartar() {
    try {
      setLoadingHold(true);
      setMessage(null);
      if (selected.length === 0) {
        setMessage("Selecciona al menos un asiento.");
        return;
      }
      const res = await fetch("/api/holds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventId, seatIds: selected }),
      });
      const data = await res.json().catch(() => ({} as any));

      if (res.status === 401) {
        setMessage("Debes iniciar sesión.");
        setTimeout(() => (window.location.href = "/auth/login"), 600);
        return;
      }
      if (!res.ok) {
        setMessage(data?.error || "No se pudieron apartar los asientos.");
        return;
      }

      // ⏱️ TIMER: guardar y arrancar countdown
      if (data?.expiresAt) {
        setExpiresAt(data.expiresAt);
        startTimer(data.expiresAt);
      }
      setHoldOk(true);
      setMessage(`Asientos apartados por ${(data?.holdMinutes ?? 10)} minutos. ¡Puedes ir a checkout!`);
    } catch {
      setMessage("Error inesperado al apartar.");
    } finally {
      setLoadingHold(false);
    }
  }

  // 2) CHECKOUT
  async function irCheckout() {
    try {
      setLoadingCheckout(true);
      setMessage(null);

      // solo por seguridad: si no hay holdOk, intenta apartar primero
      if (!holdOk) {
        await apartar();
        if (!holdOk) return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json().catch(() => ({} as any));

      if (res.status === 401) {
        setMessage("Debes iniciar sesión.");
        setTimeout(() => (window.location.href = "/auth/login"), 600);
        return;
      }
      if (!res.ok || !data?.orderId) {
        setMessage(data?.error || "No se pudo crear la orden.");
        return;
      }

      // ⏱️ TIMER: podemos parar el tick al salir al checkout
      stopTimer();

      router.push(`/checkout?orderId=${data.orderId}`);
    } catch {
      setMessage("Error inesperado al crear la orden.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  // ⏱️ TIMER: limpiar intervalo si el componente se desmonta
  useEffect(() => {
    return () => stopTimer();
  }, []);

  return (
    <div>
      {/* GRID */}
      <table className="border-collapse">
        <tbody>
          {Array.from({ length: rows }).map((_, rIdx) => (
            <tr key={rIdx}>
              {Array.from({ length: cols }).map((__, cIdx) => {
                const s = byPos.get(`${rIdx + 1}-${cIdx + 1}`);
                const isSelected = !!s && selected.includes(s.id);
                const cls = s
                  ? s.available
                    ? isSelected
                      ? "bg-blue-500 text-white"
                      : "bg-green-200"
                    : "bg-gray-300 text-gray-500"
                  : "";
                return (
                  <td
                    key={cIdx}
                    className={`${cls} border cursor-pointer text-center`}
                    style={{ width: 40, height: 30 }}
                    onClick={() => toggleSeat(s || undefined)}
                    title={s ? `${s.label} — $${(s.total / 100).toLocaleString("es-CO")}` : ""}
                  >
                    {s ? s.col : ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* RESUMEN + ACCIONES */}
      <div className="mt-3 space-y-2">
        <div className="text-sm">
          Seleccionados: <b>{selected.length}</b> — Total aprox.: <b>${(selectedTotal / 100).toLocaleString()}</b>
          {holdOk && <span className="ml-2 text-green-700">• Apartados ✅</span>}
          {/* ⏱️ TIMER: mostrar countdown */}
          {expiresAt && (
            <span className="ml-3">
              Tiempo restante: <b>{timeLeft || "00:00"}</b>
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            disabled={loadingHold || selected.length === 0}
            onClick={apartar}
            className="border px-3 py-1"
            title="Aparta temporalmente estos asientos"
          >
            {loadingHold ? "Apartando..." : "Apartar asientos"}
          </button>

          <button
            disabled={loadingCheckout || !holdOk}
            onClick={irCheckout}
            className={`border px-3 py-1 ${holdOk ? "" : "opacity-50 cursor-not-allowed"}`}
            title={holdOk ? "Crear orden" : "Primero debes apartar los asientos"}
          >
            {loadingCheckout ? "Creando orden..." : "Ir a Checkout"}
          </button>
        </div>

        {message && <p className="mt-1 text-sm text-red-600">{message}</p>}
      </div>
    </div>
  );
}
