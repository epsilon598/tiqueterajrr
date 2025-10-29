import { prisma } from "@/lib/prisma";

export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { date: "asc" },
    select: {
      id: true, name: true, date: true, basePrice: true, ivaRate: true, maxPerUser: true,
      venue: { select: { name: true } },
    },
  });
  return Response.json(events);
}
