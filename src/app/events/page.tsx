import { getBaseUrl } from "@/lib/baseUrl";

export const dynamic = "force-dynamic";

type EventItem = {
  id: string;
  name: string;
  date: string; // ISO string
  venue: { name: string } | null; // 👈 puede ser null
};

async function getEvents(): Promise<EventItem[]> {
  const base = getBaseUrl(); // síncrono
  const url = base ? `${base}/api/events` : "/api/events";

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[events/page] GET /api/events failed", { status: res.status, body: text });
    throw new Error(`No se pudieron cargar eventos (HTTP ${res.status})`);
  }
  return res.json();
}

export default async function EventsPage() {
  let events: EventItem[] = [];
  try {
    events = await getEvents();
  } catch (err) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold mb-4">Eventos</h1>
        <p className="text-red-600">
          {(err as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Eventos</h1>
      {events.length === 0 ? (
        <p className="text-gray-600">No hay eventos disponibles.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="border p-3 rounded">
              <div className="font-medium">{e.name}</div>
              <div>{new Date(e.date).toLocaleString()}</div>
              <div>Venue: {e.venue?.name ?? "-"}</div>
              <a className="underline" href={`/events/${e.id}`}>Ver asientos</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
