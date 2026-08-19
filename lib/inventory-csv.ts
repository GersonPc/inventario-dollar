export type InventoryItemKind = "equipment" | "material";
export type InventoryCondition = "working" | "not_working" | "unknown";

export type CsvRecord = {
  barcode: string;
  model: string;
  deviceType: string;
  itemKind: InventoryItemKind;
  quantity: number;
  receivedAt: string;
  delivered: boolean;
  condition: InventoryCondition;
  storeNumber: string;
  storeName: string;
  storeReference: string | null;
  deliveredAt: string | null;
  isNetworkDevice: boolean;
  macAddress: string | null;
  ipAddress: string | null;
  password: string | null;
  notes: string | null;
  sourceRow: number;
};

export type StoreCsvRecord = {
  storeNumber: string;
  name: string;
  sourceRow: number;
};

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvRows(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function normalizeDate(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  if (/^\d{5}(?:\.\d+)?$/.test(clean)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + Number(clean) * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  const latinDate = clean.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (latinDate) {
    return `${latinDate[3]}-${latinDate[2].padStart(2, "0")}-${latinDate[1].padStart(2, "0")}`;
  }
  const isoDate = clean.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2].padStart(2, "0")}-${isoDate[3].padStart(2, "0")}`;
  }
  return clean;
}

function parseBoolean(value: string): boolean {
  return ["si", "sí", "yes", "true", "1", "entregado"].includes(
    value.trim().toLowerCase(),
  );
}

function parseCondition(value: string): InventoryCondition {
  const clean = normalized(value);
  if (["si", "funciona", "funcional", "working", "bueno", "ok", "1"].includes(clean)) {
    return "working";
  }
  if (
    ["no", "no funciona", "no funcional", "not working", "danado", "defectuoso", "0"].includes(
      clean,
    )
  ) {
    return "not_working";
  }
  return "unknown";
}

const aliases: Record<string, string[]> = {
  sourceItem: ["item", "no", "numero"],
  barcode: [
    "no de serie",
    "numero de serie",
    "serie",
    "codigo de barras",
    "codigo barras",
    "barcode",
    "codigo",
    "serial",
  ],
  model: ["modelo", "model"],
  deviceType: ["tipo de equipo", "tipo de dispositivo", "tipo dispositivo", "tipo", "device type"],
  itemKind: ["clase de articulo", "tipo de registro", "clase", "inventory type"],
  quantity: ["cantidad", "unidades", "quantity"],
  receivedAt: ["fecha de inventario", "fecha de ingreso", "cuando ingreso", "ingreso", "received at"],
  delivered: ["entregado al cliente si o no", "entregado", "ya fue entregado", "delivered"],
  condition: [
    "estatus funcional o no funcional",
    "estatus",
    "funciona",
    "estado funcional",
    "condicion",
    "condition",
  ],
  storeReference: ["codigo y nombre de sala", "codigo nombre de sala", "sala"],
  storeNumber: ["no tienda", "n tienda", "numero de tienda", "numero tienda"],
  storeName: ["nombre de tienda", "nombre tienda", "tienda"],
  deliveredAt: ["fecha de entrega", "entregado el", "delivered at"],
  isNetworkDevice: ["dispositivo de red", "equipo de red", "es de red", "network device"],
  macAddress: ["mac address", "mac adress", "mac"],
  ipAddress: ["ip", "ip address", "direccion ip"],
  password: ["password", "contrasena", "clave"],
  notes: ["notas", "observaciones", "comentarios"],
};

const storeAliases: Record<"storeNumber" | "name", string[]> = {
  storeNumber: [
    "no de tienda",
    "no tienda",
    "n tienda",
    "numero de tienda",
    "numero tienda",
    "codigo de tienda",
    "codigo tienda",
    "codigo de sala",
  ],
  name: [
    "nombre de tienda",
    "nombre tienda",
    "tienda",
    "nombre de sala",
    "sala",
  ],
};

function headerIndex(rows: string[][]): number {
  let bestIndex = -1;
  let bestScore = 0;
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const headers = rows[rowIndex].map(normalized);
    const score = ["barcode", "model", "deviceType", "condition", "delivered"]
      .filter((key) => aliases[key].some((alias) => headers.includes(alias)))
      .length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
    }
  }
  return bestScore >= 2 ? bestIndex : -1;
}

function positiveQuantity(value: string, description: string): number {
  const explicit = value.trim().match(/^\d+$/);
  if (explicit) return Math.max(1, Number(explicit[0]));
  const described = description.match(/cantidad\s+(\d+)\s+unidades?/i);
  return described ? Math.max(1, Number(described[1])) : 1;
}

function isScientificSerial(value: string): boolean {
  return /^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i.test(value.trim());
}

function cleanStoreReference(value: string): string | null {
  const clean = value.trim();
  if (!clean || ["no tiene", "sin tienda", "sin asignar"].includes(normalized(clean))) {
    return null;
  }
  return clean;
}

export function mapInventoryCsv(text: string): CsvRecord[] {
  const rows = parseCsvRows(text);
  const headersAt = headerIndex(rows);
  if (headersAt < 0) return [];

  const headers = rows[headersAt].map(normalized);
  const indexOf = (key: string) =>
    aliases[key].map((alias) => headers.indexOf(alias)).find((index) => index >= 0) ?? -1;
  const positions = Object.fromEntries(
    Object.keys(aliases).map((key) => [key, indexOf(key)]),
  ) as Record<string, number>;
  const value = (row: string[], key: string) =>
    positions[key] >= 0 ? row[positions[key]]?.trim() ?? "" : "";

  return rows
    .slice(headersAt + 1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row, index) => {
      const sourceRow = headersAt + index + 2;
      const sourceItem = value(row, "sourceItem");
      const rawBarcode = value(row, "barcode");
      const rawDeviceType = value(row, "deviceType");
      const quantity = positiveQuantity(value(row, "quantity"), rawDeviceType);
      const explicitKind = normalized(value(row, "itemKind"));
      const itemKind: InventoryItemKind =
        explicitKind.includes("material") ||
        quantity > 1 ||
        (!rawBarcode && /material|cable|cantidad|unidades?/.test(normalized(rawDeviceType)))
          ? "material"
          : "equipment";
      const needsSerialReview = isScientificSerial(rawBarcode);
      const barcode = needsSerialReview
        ? `${rawBarcode}-PENDIENTE-${sourceItem || sourceRow}`
        : rawBarcode || (itemKind === "material" ? `MAT-${sourceItem || sourceRow}` : "");
      const rawNotes = value(row, "notes");
      const reviewNote = needsSerialReview
        ? `No. de Serie importado en notación científica (${rawBarcode}); requiere corrección manual.`
        : "";
      const notes = [rawNotes, reviewNote].filter(Boolean).join(" ") || null;
      const deviceType = rawDeviceType
        .replace(/\s*cantidad\s+\d+\s+unidades?\s*/i, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      const macAddress = value(row, "macAddress") || null;
      const ipAddress = value(row, "ipAddress") || null;
      const password = value(row, "password") || null;

      return {
        barcode,
        model: value(row, "model"),
        deviceType,
        itemKind,
        quantity,
        receivedAt: normalizeDate(value(row, "receivedAt")),
        delivered: parseBoolean(value(row, "delivered")),
        condition: parseCondition(value(row, "condition")),
        storeNumber: value(row, "storeNumber"),
        storeName: value(row, "storeName"),
        storeReference: cleanStoreReference(value(row, "storeReference")),
        deliveredAt: normalizeDate(value(row, "deliveredAt")) || null,
        isNetworkDevice:
          itemKind === "equipment" &&
          (parseBoolean(value(row, "isNetworkDevice")) || Boolean(macAddress || ipAddress || password)),
        macAddress,
        ipAddress,
        password,
        notes,
        sourceRow,
      };
    });
}

export function mapStoresCsv(text: string): StoreCsvRecord[] {
  const rows = parseCsvRows(text);
  let headersAt = -1;

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const headers = rows[rowIndex].map(normalized);
    const numberIndex = storeAliases.storeNumber
      .map((alias) => headers.indexOf(alias))
      .find((index) => index >= 0) ?? -1;
    const nameIndex = storeAliases.name
      .map((alias) => headers.indexOf(alias))
      .find((index) => index >= 0) ?? -1;

    if (numberIndex >= 0 && nameIndex >= 0 && numberIndex !== nameIndex) {
      headersAt = rowIndex;
      break;
    }
  }

  if (headersAt < 0) return [];

  const headers = rows[headersAt].map(normalized);
  const numberIndex = storeAliases.storeNumber
    .map((alias) => headers.indexOf(alias))
    .find((index) => index >= 0) ?? -1;
  const nameIndex = storeAliases.name
    .map((alias) => headers.indexOf(alias))
    .find((index) => index >= 0) ?? -1;

  return rows
    .slice(headersAt + 1)
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row, index) => ({
      storeNumber: row[numberIndex]?.trim() ?? "",
      name: row[nameIndex]?.trim() ?? "",
      sourceRow: headersAt + index + 2,
    }));
}
