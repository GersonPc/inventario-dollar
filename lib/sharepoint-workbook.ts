import { readSheet } from "read-excel-file/node";
import { normalizedSource, type SourceRow } from "./sharepoint-plan";

type Cell = string | number | boolean | Date | null;
const text = (value: Cell | undefined) => String(value ?? "").trim();

export function parseSourceRows(grid: Cell[][]): SourceRow[] {
  const headerAt = grid.findIndex((row, index) => index < 10 && row.some((cell) => normalizedSource(text(cell)) === "item") && row.some((cell) => normalizedSource(text(cell)) === "serie"));
  if (headerAt < 0) throw new Error("No se encontraron los encabezados de la hoja Inventario.");
  const headers = grid[headerAt].map((cell) => normalizedSource(text(cell)));
  const column = (label: string) => {
    const index = headers.findIndex((header) => header === label || header.startsWith(`${label} `));
    if (index < 0) throw new Error(`Falta la columna ${label} en Inventario.`);
    return index;
  };
  const columns = { item: column("item"), serial: column("serie"), model: column("modelo"), deviceType: column("tipo de equipo"), condition: column("estatus"), receivedAt: column("fecha de inventario"), delivered: column("entregado al cliente"), storeReference: column("codigo y") };
  const rows: SourceRow[] = [];
  const seen = new Set<string>();
  for (let index = headerAt + 1; index < grid.length; index++) {
    const cells = grid[index];
    const item = text(cells[columns.item]);
    const deviceType = text(cells[columns.deviceType]).replace(/\s+/g, " ");
    // The workbook has a second header row containing only label continuations.
    if (!item && !deviceType && index === headerAt + 1) continue;
    if (cells.every((cell) => !text(cell))) continue;
    if (!item || !/^\d+$/.test(item) || seen.has(item)) throw new Error(`Fila ${index + 1}: Item vacío, inválido o repetido. No se importó ninguna fila.`);
    seen.add(item);
    const model = text(cells[columns.model]);
    if (!model || !deviceType) throw new Error(`Fila ${index + 1}: faltan modelo o tipo de equipo.`);
    const rawDate = cells[columns.receivedAt];
    const receivedAt = rawDate instanceof Date ? rawDate.toISOString().slice(0, 10) : text(rawDate);
    if (receivedAt && !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt)) throw new Error(`Fila ${index + 1}: fecha inválida.`);
    const condition = normalizedSource(text(cells[columns.condition]));
    if (condition && !["funcional", "no funcional"].includes(condition)) throw new Error(`Fila ${index + 1}: estatus no reconocido.`);
    const delivered = normalizedSource(text(cells[columns.delivered]));
    if (delivered && !["si", "no"].includes(delivered)) throw new Error(`Fila ${index + 1}: entrega distinta de SI/NO.`);
    const store = text(cells[columns.storeReference]);
    const rawSerial = cells[columns.serial];
    const serial = text(rawSerial);
    const reliableSerial = Boolean(serial) && !["n/p", "n/a", "s/n", "sin serie"].includes(serial.toLowerCase()) &&
      !/^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(serial) && typeof rawSerial === "string";
    rows.push({ item, serial, reliableSerial, row: index + 1, model, deviceType,
      condition: condition === "funcional" ? "working" : condition === "no funcional" ? "not_working" : "unknown",
      delivered: delivered === "si", receivedAt,
      storeReference: !store || ["no tiene", "sin tienda", "sin asignar"].includes(normalizedSource(store)) ? null : store,
    });
  }
  if (!rows.length || rows.length > 5000) throw new Error("La hoja debe contener entre 1 y 5,000 equipos.");
  return rows;
}

export async function readSourceWorkbook(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  const rows = parseSourceRows(await readSheet(buffer, "Inventario") as Cell[][]);
  const summaryGrid = await readSheet(buffer, "RESUMEN") as Cell[][];
  const totals = new Map<string, { type: string; detail: number; summary: number | null }>();
  for (const row of rows) {
    const key = normalizedSource(row.deviceType);
    const current = totals.get(key) ?? { type: row.deviceType, detail: 0, summary: null };
    current.detail++; totals.set(key, current);
  }
  let summaryTotal: number | null = null;
  for (const row of summaryGrid) {
    const key = normalizedSource(text(row[0]));
    if (key === "total general" && typeof row[1] === "number") summaryTotal = row[1];
    else if (key && key !== "tipo de equipo" && key !== "(en blanco)" && typeof row[1] === "number") {
      const current = totals.get(key) ?? { type: text(row[0]), detail: 0, summary: null };
      if (current.summary !== null) throw new Error("El resumen contiene tipos repetidos.");
      current.summary = row[1]; totals.set(key, current);
    }
  }
  const summary = [...totals.values()].sort((a, b) => a.type.localeCompare(b.type, "es"));
  const summaryMatches = summaryTotal === rows.length && summary.every((group) => group.summary === group.detail);
  const warnings = rows.filter((row) => row.receivedAt && Number(row.receivedAt.slice(0, 4)) > new Date().getUTCFullYear()).map((row) => `Item ${row.item}: fecha de inventario futura (${row.receivedAt}).`);
  return { rows, summary, summaryTotal, summaryMatches, warnings };
}
