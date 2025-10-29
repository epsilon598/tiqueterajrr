// prisma/seed.ts
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcrypt";

async function main() {
  console.log("🌱 Iniciando seed...");

  // 1️⃣ Usuario Admin
  const adminEmail = "admin@tiquetera.com";
  const adminPass = "Admin1234";
  const adminHash = await bcrypt.hash(adminPass, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Administrador",
      passwordHash: adminHash,
      provider: "credentials",
      role: "ADMIN",
    },
  });

  console.log(`✅ Admin listo: ${admin.email} / ${adminPass}`);

  // 2️⃣ Venue (teatro)
  const rows = 10;
  const cols = 12;

  const venue = await prisma.venue.upsert({
    where: { name: "Teatro Central" },
    update: {},
    create: {
      name: "Teatro Central",
      address: "Calle Principal 123",
      rows,
      cols,
    },
  });

  // 3️⃣ Seats (solo si no existen)
  const seatCount = await prisma.seat.count({ where: { venueId: venue.id } });
  if (seatCount === 0) {
    const seatsData = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        seatsData.push({
          venueId: venue.id,
          row: r,
          col: c,
          label: `${String.fromCharCode(64 + r)}-${c}`, // A-1, A-2, ...
          // 💸 sobreprecio para filas 1-2 (más cercanas al escenario)
          priceOverride: r <= 2 ? 120000 : null,
        });
      }
    }

    await prisma.seat.createMany({ data: seatsData });
    console.log(`🪑 ${seatsData.length} asientos creados`);
  } else {
    console.log(`ℹ️ ${seatCount} asientos ya existen, se omite creación.`);
  }

  // 4️⃣ Evento inicial
  const event = await prisma.event.upsert({
    where: { name: "Concierto de Lanzamiento" },
    update: {},
    create: {
      name: "Concierto de Lanzamiento",
      description: "Evento de prueba con asientos asignados",
      venueId: venue.id,
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // dentro de 7 días
      basePrice: 90000, // pesos
      ivaRate: 0.19,
      maxPerUser: null,
    },
  });

  console.log(`🎟️ Evento listo: ${event.name}`);
  console.log("🏛️ Venue:", venue.name);
  console.log("🌱 Seed completado correctamente.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("❌ Error en seed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
