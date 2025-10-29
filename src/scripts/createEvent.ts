// src/scripts/createEvent.ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const venueName = "Auditorio Universidad Libre de Cali Sede Pance";

  // Busca el venue
  let venue = await prisma.venue.findFirst({ where: { name: venueName } });

  if (!venue) {
    // 👇 Agrega rows/cols requeridos por tu schema
    // Coloca valores provisionales; luego los puedes ajustar al importar tus asientos desde Excel/CSV
    venue = await prisma.venue.create({
      data: {
        name: venueName,
        rows: 1,           // <-- ajusta luego al máximo real de filas (A..JJ)
        cols: 1,           // <-- ajusta luego al máximo real de columnas
      },
    });
    console.log("✅ Venue creado:", venue.name);
  } else {
    // (Opcional) si el venue existe pero sin dimensiones correctas, actualízalas aquí
    if (venue.rows === 0 || venue.cols === 0) {
      venue = await prisma.venue.update({
        where: { id: venue.id },
        data: { rows: Math.max(1, venue.rows), cols: Math.max(1, venue.cols) },
      });
      console.log("ℹ️ Venue actualizado con dimensiones por defecto");
    }
    console.log("ℹ️ Venue ya existía:", venue.name);
  }

  const eventName = 'Gala Navideña "Cuando nos volvamos a encontrar"';
  const eventDateLocal = "2025-12-01T15:00:00-05:00"; // 1 Dic 2025 3:00 PM COL
  const eventDate = new Date(eventDateLocal);

  const existing = await prisma.event.findFirst({
    where: { name: eventName, date: eventDate, venueId: venue.id },
  });
  if (existing) {
    console.log("ℹ️ El evento ya existía. ID:", existing.id);
    return;
  }

  const event = await prisma.event.create({
    data: {
      name: eventName,
      date: eventDate,
      venueId: venue.id,
      basePrice: 0,
      ivaRate: 0,
      maxPerUser: null,
    },
    select: { id: true, name: true, date: true, venue: { select: { name: true } } },
  });

  console.log("✅ Evento creado:", event);
}

main()
  .catch((e) => {
    console.error("❌ Error creando evento:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
