import { normalizedSource, planSharePointSync, type LocalRow, type PlanRow, type SourceLink, type SourceRow, type SyncChoice } from "./sharepoint-plan";

type StoredLocal = LocalRow & { rawStoreReference: string | null };
export type SyncPreview = {
  version: string;
  origin: "sharepoint" | "file";
  rows: SourceRow[];
  locals: StoredLocal[];
  links: SourceLink[];
  plan: PlanRow[];
  summary: SourceSummary[];
  summaryTotal: number;
};

export type SourceSummary = {
  normalizedType: string;
  deviceType: string;
  quantity: number;
  warehouse: number;
  delivered: number;
  assignedToStore: number;
};

export const officialSummaryTypeKeys = new Set([
  "discos portables",
  "petty cash",
  "pin pad",
  "ups",
]);

export function summarizeSourceRows(rows: SourceRow[], excelSummary?: { type: string; detail: number; summary: number | null }[]): SourceSummary[] {
  const detail = new Map<string, SourceSummary>();
  for (const row of rows) {
    const normalizedType = normalizedSource(row.deviceType);
    if (!officialSummaryTypeKeys.has(normalizedType)) continue;
    const current = detail.get(normalizedType) ?? {
      normalizedType,
      deviceType: row.deviceType,
      quantity: 0,
      warehouse: 0,
      delivered: 0,
      assignedToStore: 0,
    };
    current.quantity += 1;
    if (row.delivered) current.delivered += 1;
    else current.warehouse += 1;
    if (row.storeReference) current.assignedToStore += 1;
    detail.set(normalizedType, current);
  }
  for (const group of excelSummary ?? []) {
    const normalizedType = normalizedSource(group.type);
    if (!officialSummaryTypeKeys.has(normalizedType)) continue;
    const current = detail.get(normalizedType) ?? {
      normalizedType,
      deviceType: group.type,
      quantity: 0,
      warehouse: 0,
      delivered: 0,
      assignedToStore: 0,
    };
    if (group.summary !== null) {
      current.quantity = group.summary;
      current.warehouse = Math.max(0, group.summary - current.delivered);
    }
    current.deviceType = group.type;
    detail.set(normalizedType, current);
  }
  return [...detail.values()].sort((a, b) => a.deviceType.localeCompare(b.deviceType, "es"));
}

export async function prepareSync(db: D1Database, rows: SourceRow[], version: string, choices: Record<string, SyncChoice>, origin: SyncPreview["origin"] = "sharepoint", excelSummary?: { type: string; detail: number; summary: number | null }[]): Promise<SyncPreview> {
  const [localResult, linkResult] = await Promise.all([
    db.prepare(`SELECT e.id, e.barcode, e.model, e.device_type AS deviceType, e.item_kind AS itemKind,
      e.condition, e.received_at AS receivedAt, e.delivered, e.delivered_at AS deliveredAt,
      e.store_id AS storeId, e.store_reference AS rawStoreReference,
      COALESCE(s.store_number, e.store_reference) AS storeReference, e.updated_at AS updatedAt
      FROM equipment e LEFT JOIN stores s ON s.id = e.store_id`).all<StoredLocal>(),
    db.prepare("SELECT item, equipment_id AS equipmentId, snapshot FROM sharepoint_links").all<SourceLink>(),
  ]);
  const locals = localResult.results.map((row) => ({ ...row, delivered: Boolean(row.delivered) }));
  const links = linkResult.results;
  const summary = summarizeSourceRows(rows, excelSummary);
  return { rows, version, origin, locals, links, plan: planSharePointSync(rows, locals, links, choices), summary, summaryTotal: summary.reduce((total, row) => total + row.quantity, 0) };
}

/** A stale guard deliberately evaluates invalid JSON, raising a SQLite error.
 * This also works if a preview was deleted. D1 rolls the whole batch back. */
export async function applySync(db: D1Database, id: string, preview: SyncPreview) {
  const previousLinks = new Map(preview.links.map((link) => [link.item, link]));
  const locals = new Map(preview.locals.map((local) => [local.id, local]));
  const actionable = preview.plan.filter((row) => row.action !== "conflict" &&
    (row.action !== "unchanged" || previousLinks.get(row.source.item)?.snapshot !== JSON.stringify(row.source)));
  if (actionable.length > 250) throw new Error("Hay más de 250 cambios pendientes. Divide la vinculación inicial en varias revisiones.");
  const assert = (condition: string, values: (string | number | null)[] = []) => db.prepare(
    `SELECT CASE WHEN ${condition} THEN json('stale-sharepoint-preview') ELSE 1 END`,
  ).bind(...values);
  const statements: D1PreparedStatement[] = [assert(
    "NOT EXISTS (SELECT 1 FROM sharepoint_previews WHERE id = ? AND consumed = 0 AND expires_at > ?)", [id, Date.now()],
  )];
  const now = new Date().toISOString();
  let created = 0; let updated = 0; let linked = 0;
  for (const row of actionable) {
    const source = row.source;
    const previous = previousLinks.get(source.item);
    const local = row.equipmentId === null ? undefined : locals.get(row.equipmentId);
    if (previous) statements.push(assert(
      "NOT EXISTS (SELECT 1 FROM sharepoint_links WHERE item = ? AND equipment_id IS ? AND snapshot = ?)",
      [source.item, previous.equipmentId, previous.snapshot],
    ));
    else statements.push(assert("EXISTS (SELECT 1 FROM sharepoint_links WHERE item = ?)", [source.item]));

    if (local) statements.push(assert(`NOT EXISTS (SELECT 1 FROM equipment WHERE id = ? AND updated_at = ?
      AND barcode = ? AND model = ? AND device_type = ? AND item_kind = ? AND condition = ? AND received_at = ?
      AND delivered = ? AND delivered_at IS ? AND store_id IS ? AND store_reference IS ?)`,
    [local.id, local.updatedAt, local.barcode, local.model, local.deviceType, local.itemKind, local.condition,
      local.receivedAt, Number(local.delivered), local.deliveredAt, local.storeId, local.rawStoreReference]));

    if (row.action === "create") {
      // Stable surrogate lives only in D1. Never write an ID or a corrected serial into Excel.
      const barcode = `SP-7E7310D7-${source.item}`;
      statements.push(db.prepare(`INSERT INTO equipment
        (barcode, model, device_type, item_kind, quantity, condition, received_at, delivered, store_id, store_reference, notes, updated_at)
        VALUES (?, ?, ?, 'equipment', 1, ?, ?, ?, (SELECT id FROM stores WHERE store_number = ?),
          CASE WHEN EXISTS (SELECT 1 FROM stores WHERE store_number = ?) THEN NULL ELSE ? END, ?, ?)`).bind(
        barcode, source.model, source.deviceType, source.condition, source.receivedAt, Number(source.delivered), source.storeReference, source.storeReference, source.storeReference,
        `SharePoint · Item ${source.item} · Serie original: ${source.serial || "sin serie"}`, now,
      ));
      statements.push(db.prepare("INSERT INTO sharepoint_links(item, equipment_id, snapshot) SELECT ?, id, ? FROM equipment WHERE barcode = ?")
        .bind(source.item, JSON.stringify(source), barcode));
      statements.push(db.prepare("INSERT INTO equipment_movements(equipment_id, action, details) SELECT equipment_id, 'imported', ? FROM sharepoint_links WHERE item = ?")
        .bind(JSON.stringify({ source: "SharePoint", item: source.item, preview: id }), source.item));
      created++;
    } else {
      if (!local) throw new Error("El equipo vinculado ya no está disponible.");
      if (row.action === "update") {
        const columnNames = { model: "model", deviceType: "device_type", condition: "condition", receivedAt: "received_at", delivered: "delivered", storeReference: "store_reference" };
        const sets: string[] = [];
        const values: (string | number | null)[] = [];
        for (const field of row.fields) {
          if (field === "storeReference") {
            sets.push("store_id = (SELECT id FROM stores WHERE store_number = ?)",
              "store_reference = CASE WHEN EXISTS (SELECT 1 FROM stores WHERE store_number = ?) THEN NULL ELSE ? END");
            values.push(source.storeReference, source.storeReference, source.storeReference);
            continue;
          }
          sets.push(`${columnNames[field]} = ?`);
          const value = source[field]; values.push(typeof value === "boolean" ? Number(value) : value);
          // Excel has no delivery date: never invent a date of delivery.
          if (field === "delivered") sets.push("delivered_at = NULL");
        }
        sets.push("updated_at = ?"); values.push(now, local.id);
        statements.push(db.prepare(`UPDATE equipment SET ${sets.join(", ")} WHERE id = ?`).bind(...values));
        statements.push(db.prepare("INSERT INTO equipment_movements(equipment_id, action, details) VALUES (?, 'imported', ?)")
          .bind(local.id, JSON.stringify({ source: "SharePoint", item: source.item, fields: row.fields, preview: id })));
        updated++;
      }
      if (previous) statements.push(db.prepare("UPDATE sharepoint_links SET snapshot = ? WHERE item = ?").bind(JSON.stringify(source), source.item));
      else {
        statements.push(db.prepare("INSERT INTO sharepoint_links(item, equipment_id, snapshot) VALUES (?, ?, ?)")
          .bind(source.item, local.id, JSON.stringify(source)));
        linked++;
      }
    }
  }
  if (!preview.summary.length || preview.summary.some((row) => !row.normalizedType || !Number.isInteger(row.quantity) || row.quantity < 0)) {
    throw new Error("El RESUMEN del Excel no contiene cantidades válidas.");
  }
  statements.push(db.prepare("DELETE FROM sharepoint_inventory_summary"));
  for (const row of preview.summary) {
    statements.push(db.prepare(`INSERT INTO sharepoint_inventory_summary
      (normalized_type, device_type, quantity, warehouse, delivered, assigned_to_store, source_version, synchronized_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      row.normalizedType, row.deviceType, row.quantity, row.warehouse, row.delivered,
      row.assignedToStore, preview.version, now,
    ));
  }
  statements.push(db.prepare(`INSERT INTO sharepoint_sync_state
    (id, source_version, row_count, summary_total, synchronized_at) VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET source_version = excluded.source_version, row_count = excluded.row_count,
      summary_total = excluded.summary_total, synchronized_at = excluded.synchronized_at`).bind(
    preview.version, preview.rows.length, preview.summaryTotal, now,
  ));
  statements.push(db.prepare("UPDATE sharepoint_previews SET consumed = 1 WHERE id = ?").bind(id));
  try { await db.batch(statements); }
  catch { throw new Error("Los datos o vínculos cambiaron durante la revisión. No se aplicó esta importación; genera otra vista previa."); }
  return { created, updated, linked, conflicts: preview.plan.filter((row) => row.action === "conflict").length, summaryTotal: preview.summaryTotal };
}
