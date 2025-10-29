// prisma/seed.ts
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcrypt";

/** Convierte número → etiqueta tipo Excel (1=A, 26=Z, 27=AA, etc.) */
function numberToLabel(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Genera etiquetas hasta el número indicado */
function generateRowLabelsCount(N: number): string[] {
  return Array.from({ length: N }, (_, i) => numberToLabel(i + 1));
}

async function main() {
  console.log("🌱  Iniciando seed (Gala Navideña)…");

  // --- ADMIN ---
  const adminEmail = "admin@tiquetera.com";
  const adminPass = "Admin1234";
  const adminHash = await bcrypt.hash(adminPass, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: adminHash,
      provider: "credentials",
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin creado: ${adminEmail} / ${adminPass}`);

  // --- VENUE ---
  const venue = await prisma.venue.upsert({
    where: { name: "Auditorio Universidad Libre de Cali Sede Pance" },
    update: {},
    create: {
      name: "Auditorio Universidad Libre de Cali Sede Pance",
      address: "Cali, Sede Pance",
      rows: 35,
      cols: 30,
    },
  });
  console.log(`🏛️ Venue: ${venue.name}`);

  // --- ASIENTOS ---
  const TOTAL_ROWS = 35;
  const COLS = 30;
  const rowLabels = generateRowLabelsCount(TOTAL_ROWS); // A..AI (35 filas)

  const seatsData: any[] = [];

  for (let i = 0; i < TOTAL_ROWS; i++) {
    const rowLabel = rowLabels[i];
    const rowNumber = i + 1;

    for (let col = 1; col <= COLS; col++) {
      // A..U → 50k, resto 30k
      const price = rowNumber <= 21 ? 50000 : 30000;

      seatsData.push({
        venueId: venue.id,
        row: rowNumber,
        col,
        label: `${rowLabel}${col}`,
        priceOverride: price,
      });
    }
  }

  // Limpia e inserta
  await prisma.seat.deleteMany({ where: { venueId: venue.id } });
  await prisma.seat.createMany({ data: seatsData });
  console.log(`🎟️ ${seatsData.length} asientos insertados.`);

  // Actualiza filas/columnas
  await prisma.venue.update({
    where: { id: venue.id },
    data: { rows: TOTAL_ROWS, cols: COLS },
  });

  // --- EVENTO ---
  const event = await prisma.event.upsert({
    where: { name: 'Gala Navideña "Cuando nos volvamos a encontrar"' },
    update: {},
    create: {
      name: 'Gala Navideña "Cuando nos volvamos a encontrar"',
      description:
        "Un evento especial de temporada, con música, luces y reencuentros inolvidables.",
      venueId: venue.id,
      date: new Date("2025-12-01T15:00:00-05:00"),
      basePrice: 50000,
      ivaRate: 0.19,
      maxPerUser: null,
    },
  });

  console.log("🎉 Evento creado:", event.name);
  console.log("📅 Fecha:", event.date.toLocaleString());
  console.log("📍 Lugar:", venue.name);
}

main()
  .then(async () => {
    console.log("✅ Seed completado correctamente.");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error en seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
