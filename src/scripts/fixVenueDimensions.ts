// src/scripts/fixVenueDimensions.ts
import { prisma } from "@/lib/prisma";

async function main() {
  // Permite pasar el venueId por CLI:  npx tsx src/scripts/fixVenueDimensions.ts <venueId>
  const venueId = process.argv[2];
  if (!venueId) {
    throw new Error("Uso: npx tsx src/scripts/fixVenueDimensions.ts <venueId>");
  }

  // Verifica que exista el venue
  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) {
    throw new Error(`No existe el venue con id=${venueId}`);
  }

  // Calcula máximos directamente en DB
  const agg = await prisma.seat.aggregate({
    where: { venueId },
    _max: { row: true, col: true },
  });

  const maxRow = agg._max.row ?? 0;
  const maxCol = agg._max.col ?? 0;

  if (!maxRow || !maxCol) {
    console.warn("⚠️ No hay asientos para este venue o todos tienen 0 en row/col.");
    console.warn("   ¿Ejecutaste el seed con el venueId correcto?");
    return;
  }

  const updated = await prisma.venue.update({
    where: { id: venueId },
    data: { rows: maxRow, cols: maxCol },
  });

  console.log("✅ Venue actualizado:", {
    id: updated.id,
    name: updated.name,
    rows: updated.rows,
    cols: updated.cols,
  });
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
