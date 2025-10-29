import { getBaseUrl } from "@/lib/baseUrl";

type EventItem = {
  id: string;
  name: string;
  date: string;
  venue: { name: string };
};

async function getEvents(): Promise<EventItem[]> {
  const base = getBaseUrl(); // 👈 ya NO es async
  const res = await fetch(`${base}/api/events`, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron cargar eventos");
  return res.json();
}

export default async function EventsPage() {
  const events = await getEvents();
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Eventos</h1>
      <ul className="space-y-2">
        {events.map((e) => (
          <li key={e.id} className="border p-3 rounded">
            <div className="font-medium">{e.name}</div>
            <div>{new Date(e.date).toLocaleString()}</div>
            <div>Venue: {e.venue.name}</div>
            <a className="underline" href={`/events/${e.id}`}>Ver asientos</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
