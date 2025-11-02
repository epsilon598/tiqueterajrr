// src/app/events/[id]/page.tsx
import SeatGridClient, { type SeatItem } from "./SeatGridClient";
import { getBaseUrl } from "@/lib/baseUrl";

export const dynamic = "force-dynamic";

type SeatsResponse = {
  event: {
    id: string;
    name: string;
    date: string;
    venue: { rows: number; cols: number; name: string } | null;
  } | null;
  seats: SeatItem[] | null;
};

async function fetchSeats(eventId: string): Promise<SeatsResponse> {
  const base = getBaseUrl(); // síncrono
  const url = base ? `${base}/api/events/${eventId}/seats` : `/api/events/${eventId}/seats`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`No se pudieron cargar asientos (${res.status}) ${text}`);
  }
  const data = (await res.json()) as SeatsResponse;

  if (!data?.event) throw new Error("Respuesta inválida: falta 'event'.");
  if (!data.event.venue) throw new Error("Respuesta inválida: falta 'event.venue'.");
  if (!Array.isArray(data.seats)) throw new Error("Respuesta inválida: 'seats' no es un arreglo.");

  return data;
}

export default async function EventSeatsPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  // 👇 si es Promise, lo esperamos; si no, lo usamos directo
  const resolvedParams = await Promise.resolve(params);
  const eventId = resolvedParams.id;


  let data: SeatsResponse | null = null;
  let errorMsg: string | null = null;

  try {
    data = await fetchSeats(eventId);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Error desconocido al cargar asientos.";
  }

  if (errorMsg || !data?.event || !data.event.venue || !Array.isArray(data.seats)) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Asientos</h1>
        <p className="text-red-600 mt-2">{errorMsg ?? "Sin datos válidos del evento."}</p>
      </div>
    );
  }

  const rows = Number(data.event.venue.rows ?? 0);
  const cols = Number(data.event.venue.cols ?? 0);
  const seats = data.seats ?? [];

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-2">{data.event.name}</h1>
      <div className="text-sm text-gray-600 mb-4">
        Venue: {data.event.venue.name} — {rows} x {cols}
      </div>

      <SeatGridClient eventId={data.event.id} rows={rows} cols={cols} seats={seats} />
    </div>
  );
}
