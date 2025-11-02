// src/scripts/cleanTransactional.ts
import { prisma } from "@/lib/prisma";

/**
 * Limpia data transaccional:
 * - Ticket
 * - SeatHold
 * - OrderSeat
 * - Order
 *
 * Soporta:
 *   --all                Limpia todos los eventos
 *   --event=<EVENT_ID>   Limpia solo un evento
 *   --dry-run            Solo muestra conteos, no borra
 *
 * Ejemplos:
 *   npx tsx src/scripts/cleanTransactional.ts --all
 *   npx tsx src/scripts/cleanTransactional.ts --event=cmhb...k2ox
 *   npx tsx src/scripts/cleanTransactional.ts --event=cmhb...k2ox --dry-run
 */

type Args = {
  all: boolean;
  eventId?: string;
  dryRun: boolean;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { all: false, dryRun: false };
  for (const a of args) {
    if (a === "--all") out.all = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--event=")) out.eventId = a.split("=")[1]?.trim();
  }
  return out;
}

async function main() {
  const { all, eventId, dryRun } = parseArgs();

  if (!all && !eventId) {
    console.error("❌ Debes pasar --all o --event=<EVENT_ID>");
    process.exit(1);
  }
  if (all && eventId) {
    console.error("❌ Usa sólo uno: --all o --event=<EVENT_ID>");
    process.exit(1);
  }

  // ===== PREVIEW (conteos) =====
  let ticketsCount = 0;
  let holdsCount = 0;
  let orderItemsCount = 0;
  let ordersCount = 0;

  if (all) {
    [ticketsCount, holdsCount, orderItemsCount, ordersCount] = await Promise.all([
      prisma.ticket.count(),
      prisma.seatHold.count(),
      prisma.orderSeat.count(),
      prisma.order.count(),
    ]);
  } else {
    const evId = eventId!;
    [ticketsCount, holdsCount, orderItemsCount, ordersCount] = await Promise.all([
      prisma.ticket.count({ where: { eventId: evId } }),
      prisma.seatHold.count({ where: { eventId: evId } }),
      prisma.orderSeat.count({
        where: {
          order: { eventId: evId }, // OrderSeat no tiene eventId directo
        },
      }),
      prisma.order.count({ where: { eventId: evId } }),
    ]);
  }

  console.log("== Previsualización ==");
  if (all) console.log("Ámbito: TODOS los eventos");
  else console.log(`Ámbito: eventId=${eventId}`);
  console.log(`Tickets:      ${ticketsCount}`);
  console.log(`SeatHolds:    ${holdsCount}`);
  console.log(`OrderItems:   ${orderItemsCount}`);
  console.log(`Orders:       ${ordersCount}`);
  console.log(dryRun ? "Modo: DRY RUN (no se borrará nada)\n" : "Modo: EJECUCIÓN\n");

  if (dryRun) {
    await prisma.$disconnect();
    return;
  }

  // ===== DELETE (orden seguro por FKs) =====
  // 1) Tickets
  // 2) SeatHolds
  // 3) OrderSeat
  // 4) Orders
  const deleted = await prisma.$transaction(async (tx) => {
    let d1, d2, d3, d4;

    if (all) {
      d1 = await tx.ticket.deleteMany();
      d2 = await tx.seatHold.deleteMany();
      d3 = await tx.orderSeat.deleteMany();
      d4 = await tx.order.deleteMany();
    } else {
      const evId = eventId!;
      d1 = await tx.ticket.deleteMany({ where: { eventId: evId } });
      d2 = await tx.seatHold.deleteMany({ where: { eventId: evId } });
      d3 = await tx.orderSeat.deleteMany({
        where: {
          order: { eventId: evId },
        },
      });
      d4 = await tx.order.deleteMany({ where: { eventId: evId } });
    }

    return { d1, d2, d3, d4 };
  });

  console.log("== Borrado completado ==");
  console.log(`Tickets borrados:    ${deleted.d1.count}`);
  console.log(`SeatHolds borrados:  ${deleted.d2.count}`);
  console.log(`OrderItems borrados: ${deleted.d3.count}`);
  console.log(`Orders borradas:     ${deleted.d4.count}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Error en limpieza:", err);
  await prisma.$disconnect();
  process.exit(1);
});
