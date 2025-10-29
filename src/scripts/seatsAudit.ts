// src/scripts/seatsAudit.ts
import { prisma } from "@/lib/prisma";

async function main() {
  const venueId = process.argv[2];
  if (!venueId) {
    console.error("Uso: npx tsx src/scripts/seatsAudit.ts <venueId>");
    process.exit(1);
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true, name: true, rows: true, cols: true },
  });
  console.log("Venue:", venue);

  const count = await prisma.seat.count({ where: { venueId } });
  console.log("Seat count:", count);

  const sample = await prisma.seat.findMany({
    where: { venueId },
    select: { id: true, row: true, col: true, label: true },
    orderBy: [{ row: "asc" }, { col: "asc" }],
    take: 10,
  });
  console.log("Sample seats:", sample);

  const max = await prisma.seat.aggregate({
    where: { venueId },
    _max: { row: true, col: true },
  });
  console.log("Max row/col:", max._max);
}

main().finally(() => prisma.$disconnect());
