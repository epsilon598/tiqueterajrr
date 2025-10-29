// src/scripts/seedSeatsFromCSV.ts
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";

/** Convierte etiqueta tipo "A", "Z", "AA", "AB" a número de fila (1-based) */
function labelToRow(labelRaw: string): number {
  const label = labelRaw.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(label)) throw new Error(`Etiqueta de fila inválida: "${labelRaw}"`);
  let n = 0;
  for (let i = 0; i < label.length; i++) {
    n = n * 26 + (label.charCodeAt(i) - 64); // 'A'->1 ... 'Z'->26
  }
  return n; // 1..26, 27=AA, 28=AB ...
}

type CsvRow = {
  row: string;   // ej: "A", "AA"
  number: string; // número de asiento en esa fila, ej: "1", "17"
  label?: string; // etiqueta visible, opcional
};

async function main() {
  const csvPath = process.argv[2];
  const venueId = process.argv[3];

  if (!csvPath || !venueId) {
    console.error("Uso: npx tsx src/scripts/seedSeatsFromCSV.ts <ruta CSV> <venueId>");
    process.exit(1);
  }

  const abs = path.resolve(csvPath);
  if (!fs.existsSync(abs)) throw new Error(`No existe el archivo CSV: ${abs}`);

  const csvText = fs.readFileSync(abs, "utf8");

  const parsed = Papa.parse(csvText, {
    header: true,          // CSV con cabecera
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (parsed.errors?.length) {
    console.error("Errores al parsear CSV:", parsed.errors);
    throw new Error("CSV inválido");
  }

  // Normaliza nombres de columnas esperadas: row, number, label (label opcional)
  const rows: CsvRow[] = (parsed.data as any[]).map((r, idx) => {
    // aceptamos alias comunes
    const row = (r.row ?? r.Row ?? r.fila ?? r.Fila ?? "").toString().trim();
    const number = (r.number ?? r.Number ?? r.seat ?? r.Seat ?? r.col ?? r.Col ?? "").toString().trim();
    const label = (r.label ?? r.Label ?? r.asiento ?? r.Asiento ?? "").toString().trim();

    if (!row || !number) {
      throw new Error(`Fila ${idx + 1}: faltan columnas requeridas "row" y/o "number"`);
    }
    return { row, number, label };
  });

  if (rows.length === 0) {
    throw new Error("El CSV no contenía filas válidas");
  }

  // Construye los registros para insert
  const toInsert = rows.map((r) => {
    const rowNum = labelToRow(r.row);
    const colNum = Number(r.number);
    if (!Number.isFinite(colNum) || colNum <= 0) {
      throw new Error(`Número de asiento inválido en fila ${r.row}: "${r.number}"`);
    }
    const label = r.label && r.label.length > 0 ? r.label : `${r.row}${colNum}`;
    return {
      venueId,
      row: rowNum,
      col: colNum,
      label,
      priceOverride: null as number | null,
    };
  });

  // Limpia asientos existentes del venue (opcional; comenta si no quieres)
  await prisma.seat.deleteMany({ where: { venueId } });

  // Inserta en batch
  await prisma.seat.createMany({ data: toInsert, skipDuplicates: true });

  // Ajusta rows/cols en Venue
  const agg = await prisma.seat.aggregate({
    where: { venueId },
    _max: { row: true, col: true },
  });

  const updated = await prisma.venue.update({
    where: { id: venueId },
    data: { rows: agg._max.row ?? 0, cols: agg._max.col ?? 0 },
  });

  console.log("✅ Listo. Resumen:");
  console.log("- Asientos insertados:", toInsert.length);
  console.log("- Venue actualizado:", updated);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
