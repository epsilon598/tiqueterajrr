"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type SeatItem = {
  id: string;
  row: number;
  col: number;
  label: string;
  price: number; // CENTAVOS
  iva: number;   // CENTAVOS
  total: number; // CENTAVOS
  available: boolean;
};

interface SeatGridClientProps {
  eventId: string;
  rows: number;
  cols: number;
  seats: SeatItem[];
}

function toRowLetter(n: number) {
  // 1->A, 2->B … 26->Z, 27->AA …
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export default function SeatGridClient({ eventId, rows, cols, seats }: SeatGridClientProps) {
  const router = useRouter();

  // pos -> asiento
  const byPos = useMemo(() => {
    const map = new Map<string, SeatItem>();
    seats.forEach((s) => map.set(`${s.row}-${s.col}`, s));
    return map;
  }, [seats]);

  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingHold, setLoadingHold] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [holdOk, setHoldOk] = useState(false);

  // ⏱️ TIMER
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  function formatCountdown(targetISO: string) {
    const target = new Date(targetISO).getTime();
    const diff = target - Date.now();
    if (diff <= 0) return "00:00";
    const s = Math.floor(diff / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

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
    } catch {}
    finally {
      setSelected([]);
      setHoldOk(false);
      setExpiresAt(null);
      setTimeLeft("");
      setMessage("Se liberaron los asientos por tiempo agotado.");
      router.refresh();
    }
  }

  function toggleSeat(s?: SeatItem) {
    if (!s || !s.available) return;
    setHoldOk(false);
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

      stopTimer();
      router.push(`/checkout?orderId=${data.orderId}`);
    } catch {
      setMessage("Error inesperado al crear la orden.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  useEffect(() => () => stopTimer(), []);

  // ---------- UI ----------
  return (
    <div>
      {/* Leyenda */}
      <div className="flex items-center gap-4 text-sm mb-3">
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-3 rounded border border-gray-300 bg-white" />
          Vacío
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-3 rounded border border-emerald-600 bg-emerald-100" />
          Disponible
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-3 rounded border border-blue-600 bg-blue-500" />
          Seleccionado
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="inline-block w-4 h-3 rounded border border-gray-500 bg-gray-300" />
          No disponible
        </span>
      </div>

      {/* Cabeceras */}
      <div className="overflow-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-1" />
              {Array.from({ length: cols }).map((_, cIdx) => (
                <th key={cIdx} className="p-1 text-xs text-gray-600">{cIdx + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rIdx) => (
              <tr key={rIdx}>
                <th className="pr-2 text-xs text-gray-600 text-right">{toRowLetter(rIdx + 1)}</th>
                {Array.from({ length: cols }).map((__, cIdx) => {
                  const s = byPos.get(`${rIdx + 1}-${cIdx + 1}`);
                  const isSelected = !!s && selected.includes(s.id);

                  let cls =
                    "border text-center align-middle rounded-sm select-none " +
                    "transition-[transform,box-shadow] duration-150 ease-out ";

                  if (!s) {
                    cls += "bg-white border-gray-300 text-transparent ";
                  } else if (!s.available) {
                    cls += "bg-gray-300 border-gray-500 text-gray-500 cursor-not-allowed ";
                  } else if (isSelected) {
                    cls += "bg-blue-500 border-blue-600 text-white shadow-sm ring-2 ring-blue-300 ";
                  } else {
                    cls += "bg-emerald-100 border-emerald-600 hover:shadow hover:scale-[1.03] cursor-pointer ";
                  }

                  return (
                    <td
                      key={cIdx}
                      className={cls}
                      style={{ width: 38, height: 28 }}
                      onClick={() => toggleSeat(s || undefined)}
                      title={
                        s
                          ? `${s.label} — $${(s.total / 100).toLocaleString("es-CO")} COP`
                          : ""
                      }
                    >
                      {s ? s.col : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RESUMEN + ACCIONES */}
      <div className="mt-4 space-y-2">
        <div className="text-sm">
          Seleccionados: <b>{selected.length}</b> — Total:{" "}
          <b>${(selectedTotal / 100).toLocaleString("es-CO")} COP</b>
          {holdOk && <span className="ml-2 text-green-700">• Apartados ✅</span>}
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
            className="border px-3 py-1 rounded hover:bg-gray-50 disabled:opacity-50"
            title="Aparta temporalmente estos asientos"
          >
            {loadingHold ? "Apartando..." : "Apartar asientos"}
          </button>

          <button
            disabled={loadingCheckout || !holdOk}
            onClick={irCheckout}
            className={`border px-3 py-1 rounded hover:bg-gray-50 ${holdOk ? "" : "opacity-50 cursor-not-allowed"}`}
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
