// src/scripts/createVenue.ts
import { prisma } from "@/lib/prisma";

async function main() {
  const venue = await prisma.venue.upsert({
    where: { name: "Auditorio Universidad Libre de Cali (Sede Pance)" },
    update: { rows: 35, cols: 30 },
    create: {
      name: "Auditorio Universidad Libre de Cali (Sede Pance)",
      rows: 35,
      cols: 30,
    },
  });

  console.log("Venue listo:", venue);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
