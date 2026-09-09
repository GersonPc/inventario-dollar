import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdir, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const temporary = new URL(`../.wrangler/sharepoint-test-${process.pid}.mjs`, import.meta.url);
await mkdir(new URL("../.wrangler/", import.meta.url), { recursive: true });
await build({ stdin: { contents: 'export * from "./lib/sharepoint-plan.ts"; export * from "./lib/sharepoint-workbook.ts"; export * from "./lib/sharepoint-source.ts"; export * from "./lib/sharepoint-sync.ts";', resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: fileURLToPath(temporary) });
after(() => rm(temporary));
const { planSharePointSync, parseSourceRows, downloadSharePointWorkbook, readBounded, sharePointSource, prepareSync, applySync, summarizeSourceRows } = await import(temporary.href);

const source = { item: "1", row: 4, serial: "UPS-001", reliableSerial: true, model: "UPS 850", deviceType: "ups", condition: "not_working", receivedAt: "2026-08-05", delivered: false, storeReference: null };
const local = { id: 1, barcode: source.serial, itemKind: "equipment", model: source.model, deviceType: "ups", condition: source.condition, receivedAt: source.receivedAt, delivered: false, storeReference: null, rawStoreReference: null, storeId: null, deliveredAt: null, updatedAt: "2026-09-01T00:00:00.000Z" };
const link = { item: "1", equipmentId: 1, snapshot: JSON.stringify(source) };

test("initial pairing never overwrites local delivery and repeated serials require a choice", () => {
  assert.equal(planSharePointSync([source], [{ ...local, delivered: true }], [])[0].action, "link");
  const discs = ["1", "2"].map((item) => ({ ...source, item, serial: "N/P", reliableSerial: false }));
  assert.deepEqual(planSharePointSync(discs, [local], []).map((row) => row.action), ["conflict", "conflict"]);
  assert.equal(planSharePointSync([source], [local], [], { 1: "skip" })[0].action, "conflict");
});

test("three-way merge applies a source condition while preserving local delivery", () => {
  const row = planSharePointSync([{ ...source, condition: "working" }], [{ ...local, delivered: true, storeReference: "2302" }], [link])[0];
  assert.equal(row.action, "update");
  assert.deepEqual(row.fields, ["condition"]);
});

test("conflicting condition, moved Item, deleted local equipment and duplicate bindings are blocked", () => {
  assert.equal(planSharePointSync([{ ...source, condition: "working" }], [{ ...local, condition: "unknown" }], [link])[0].action, "conflict");
  assert.equal(planSharePointSync([{ ...source, serial: "OTHER" }], [local], [link])[0].action, "conflict");
  assert.equal(planSharePointSync([source], [], [{ ...link, equipmentId: null }])[0].action, "conflict");
  assert.deepEqual(planSharePointSync([source, { ...source, item: "2" }], [local], [], { 1: 1, 2: 1 }).map((row) => row.action), ["conflict", "conflict"]);
});

test("parser handles split headers, N/P, numeric serials, and refuses duplicate Items", () => {
  const headers = ["Item", "Código y", "Tipo de equipo", "Modelo", "Serie", "Estatus", "Fecha de inventario", "Entregado al cliente"];
  const row = [1, "No tiene", "ups", "UPS 850", "N/P", "No funcional", new Date("2026-08-05T00:00:00Z"), "NO"];
  const parsed = parseSourceRows([["Inventario 2026"], headers, [null, "nombre de sala", null, null, null, "(funcional o no funcional)"], row]);
  assert.equal(parsed.length, 1); assert.equal(parsed[0].reliableSerial, false); assert.equal(parsed[0].storeReference, null);
  assert.equal(parseSourceRows([headers, [2, null, "ups", "UPS 850", 10220000000000, "FUNCIONAL", null, "NO"]])[0].reliableSerial, false);
  assert.throws(() => parseSourceRows([headers, row, row]), /repetido/);
  assert.throws(() => parseSourceRows([headers, [...row.slice(0, 7), "maybe"]]), /SI\/NO/);
});

test("the official summary uses the RESUMEN worksheet quantities", () => {
  const rows = [
    { ...source, item: "1", delivered: false },
    { ...source, item: "2", delivered: true, storeReference: "2302" },
    { ...source, item: "3", deviceType: "PANTALLA NCR", delivered: false },
  ];
  const summary = summarizeSourceRows(rows, [
    { type: "ups", detail: 2, summary: 3 },
    { type: "PANTALLA NCR", detail: 1, summary: 1 },
  ]);
  assert.deepEqual(summary, [{
    normalizedType: "ups", deviceType: "ups", quantity: 3,
    warehouse: 2, delivered: 1, assignedToStore: 1,
  }]);
});

const config = { SHAREPOINT_CLIENT_ID: "client", SHAREPOINT_CLIENT_SECRET: "test-secret", SHAREPOINT_DRIVE_ID: "drive", SHAREPOINT_ITEM_ID: "item" };
test("Graph only reads the authorized file, never sends its token to the download URL", async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/token")) return Response.json({ access_token: "test-access-token" });
    if (String(url).includes("$select=id")) return Response.json({ name: "inventory.xlsx", eTag: "v1", size: 3, webUrl: `https://${sharePointSource.hostname}/file.xlsx`, sharepointIds: { listItemUniqueId: sharePointSource.documentId } });
    if (String(url).endsWith("/content")) return new Response(null, { status: 302, headers: { location: `https://${sharePointSource.hostname}/download` } });
    if (String(url).endsWith("/download")) return new Response(new Uint8Array([1, 2, 3]));
    return Response.json({ eTag: "v1" });
  };
  const result = await downloadSharePointWorkbook(config, fetcher);
  assert.equal(result.version, "v1");
  assert.deepEqual(calls.map((call) => call.options.method), ["POST", "GET", "GET", "GET", "GET"]);
  assert.equal(calls[3].options.headers, undefined);
  assert.equal(calls[0].options.body.get("scope"), "https://graph.microsoft.com/.default");
});

test("unexpected document identity and oversized responses are rejected", async () => {
  await assert.rejects(downloadSharePointWorkbook(config, async (url) => String(url).includes("/token") ? Response.json({ access_token: "test" }) : Response.json({ webUrl: "https://other.sharepoint.com/file.xlsx", sharepointIds: { listItemUniqueId: "other" } })), /no es el inventario/);
  await assert.rejects(readBounded(new Response(new Uint8Array(20)), 10), /tamaño/);
});

function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE stores(id INTEGER PRIMARY KEY, store_number TEXT);
    CREATE TABLE equipment(id INTEGER PRIMARY KEY, barcode TEXT UNIQUE, model TEXT, device_type TEXT, item_kind TEXT, quantity INTEGER, condition TEXT, received_at TEXT, delivered INTEGER, delivered_at TEXT, store_id INTEGER, store_reference TEXT, notes TEXT, updated_at TEXT);
    CREATE TABLE equipment_movements(id INTEGER PRIMARY KEY, equipment_id INTEGER, action TEXT, details TEXT);
    CREATE TABLE sharepoint_links(item TEXT PRIMARY KEY, equipment_id INTEGER UNIQUE REFERENCES equipment(id) ON DELETE SET NULL, snapshot TEXT NOT NULL);
    CREATE TABLE sharepoint_previews(id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE sharepoint_inventory_summary(normalized_type TEXT PRIMARY KEY, device_type TEXT NOT NULL, quantity INTEGER NOT NULL, warehouse INTEGER NOT NULL, delivered INTEGER NOT NULL, assigned_to_store INTEGER NOT NULL, source_version TEXT NOT NULL, synchronized_at TEXT NOT NULL);
    CREATE TABLE sharepoint_sync_state(id INTEGER PRIMARY KEY, source_version TEXT NOT NULL, row_count INTEGER NOT NULL, summary_total INTEGER NOT NULL, synchronized_at TEXT NOT NULL);`);
  sql.prepare("INSERT INTO equipment VALUES(1, ?, ?, 'ups', 'equipment', 1, 'not_working', ?, 0, NULL, NULL, NULL, 'local notes', ?)")
    .run(local.barcode, local.model, local.receivedAt, local.updatedAt);
  sql.prepare("INSERT INTO sharepoint_links VALUES(?, ?, ?)").run(link.item, link.equipmentId, link.snapshot);
  const db = {
    prepare(query) {
      const statement = { values: [], bind(...values) { this.values = values; return this; }, async all() { return { results: sql.prepare(query).all(...this.values) }; }, async first() { return sql.prepare(query).get(...this.values) ?? null; }, execute() { return sql.prepare(query).run(...this.values); } };
      return statement;
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try { const result = statements.map((statement) => statement.execute()); sql.exec("COMMIT"); return result; }
      catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  const save = (id, preview) => sql.prepare("INSERT INTO sharepoint_previews(id, payload, expires_at) VALUES(?, ?, ?)").run(id, JSON.stringify(preview), Date.now() + 60000);
  return { sql, db, save };
}

test("applying twice is blocked and source sync preserves local notes and delivery", async () => {
  const { sql, db, save } = database();
  sql.exec("UPDATE equipment SET delivered = 1, store_reference = '2302'");
  const preview = await prepareSync(db, [{ ...source, condition: "working" }], "v2", {});
  save("preview", preview);
  const result = await applySync(db, "preview", preview);
  assert.equal(result.updated, 1);
  const row = sql.prepare("SELECT * FROM equipment").get();
  assert.equal(row.condition, "working"); assert.equal(row.delivered, 1); assert.equal(row.notes, "local notes");
  await assert.rejects(applySync(db, "preview", preview), /No se aplicó/);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM equipment_movements").get().n, 1);
  sql.close();
});

test("an edit after preview rolls back updates, movements and baseline", async () => {
  const { sql, db, save } = database();
  const preview = await prepareSync(db, [{ ...source, condition: "working" }], "v2", {});
  save("preview", preview);
  // Deliberately keep the same timestamp: guards must compare actual fields too.
  sql.exec("UPDATE equipment SET condition = 'unknown'");
  await assert.rejects(applySync(db, "preview", preview), /No se aplicó/);
  assert.equal(sql.prepare("SELECT snapshot FROM sharepoint_links").get().snapshot, link.snapshot);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM equipment_movements").get().n, 0);
  assert.equal(sql.prepare("SELECT consumed FROM sharepoint_previews").get().consumed, 0);
  sql.close();
});

test("explicit creation generates a unique local ID; missing source rows do not delete equipment", async () => {
  const { sql, db, save } = database();
  const disc = { ...source, item: "2", serial: "N/P", reliableSerial: false };
  const preview = await prepareSync(db, [disc], "v2", { 2: "create" }, "file");
  save("preview", preview);
  assert.equal((await applySync(db, "preview", preview)).created, 1);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM equipment").get().n, 2);
  assert.equal(sql.prepare("SELECT barcode FROM equipment WHERE id = 2").get().barcode, "SP-7E7310D7-2");
  sql.close();
});

test("applying a preview replaces the official summary without deleting app inventory", async () => {
  const { sql, db, save } = database();
  sql.prepare("INSERT INTO sharepoint_inventory_summary VALUES(?, ?, ?, ?, ?, ?, ?, ?)")
    .run("old", "OLD", 99, 99, 0, 0, "v1", "2026-09-01T00:00:00.000Z");
  const excelSummary = [{ type: "ups", detail: 1, summary: 57 }];
  const preview = await prepareSync(db, [source], "v2", {}, "file", excelSummary);
  save("summary-preview", preview);
  const result = await applySync(db, "summary-preview", preview);
  assert.equal(result.summaryTotal, 57);
  assert.deepEqual(sql.prepare("SELECT device_type, quantity, warehouse, delivered FROM sharepoint_inventory_summary").all().map((row) => ({ ...row })), [
    { device_type: "ups", quantity: 57, warehouse: 57, delivered: 0 },
  ]);
  assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM equipment").get().n, 1);
  assert.equal(sql.prepare("SELECT summary_total FROM sharepoint_sync_state WHERE id = 1").get().summary_total, 57);
  sql.close();
});
