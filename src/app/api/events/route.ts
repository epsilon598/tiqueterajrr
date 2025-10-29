import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: "asc" },
      select: {
        id: true,
        name: true,
        date: true,            // Date -> lo convertimos abajo a ISO
        basePrice: true,
        ivaRate: true,
        maxPerUser: true,
        venue: { select: { name: true } }, // puede ser null
      },
    });

    const data = events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.date instanceof Date ? e.date.toISOString() : String(e.date),
      // la página solo usa name; mantenemos venue tal cual (o null)
      venue: e.venue ? { name: e.venue.name } : null,
      // si luego quieres más campos, agrégalos aquí y ajusta el tipo en la página
    }));

    return Response.json(data);
  } catch (err) {
    console.error("[/api/events] Prisma error:", err);
    return new Response("DB error al listar eventos", { status: 500 });
  }
}
