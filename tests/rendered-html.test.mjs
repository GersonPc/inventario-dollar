import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Inventory Dollar application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="es">/i);
  assert.match(html, /<title>Inventario \| Bodega Dollar<\/title>/i);
  assert.match(html, /Preparando la bodega/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("declares durable storage, protected credentials and temporary public access", async () => {
  const [hosting, wrangler, schema, cryptoSource, authSource, accessSource, apiSource, csvTemplate] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/inventory-crypto.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/inventory-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/chatgpt-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/inventory/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/plantilla-inventario.csv", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(wrangler, /"binding":\s*"DB"/);
  assert.match(wrangler, /"CF_ACCESS_AUD":\s*"[a-f0-9]{64}"/);
  assert.match(wrangler, /"CF_ACCESS_TEAM_DOMAIN":\s*"https:\/\/[a-z0-9-]+\.cloudflareaccess\.com"/);
  assert.match(wrangler, /"INVENTORY_PUBLIC_ACCESS":\s*"true"/);
  assert.match(schema, /idx_equipment_barcode_unique/);
  assert.match(schema, /itemKind/);
  assert.match(schema, /quantity/);
  assert.match(schema, /storeReference/);
  assert.match(schema, /equipmentMovements/);
  assert.match(cryptoSource, /AES-GCM/);
  assert.match(authSource, /INVENTORY_ADMIN_EMAIL/);
  assert.match(authSource, /INVENTORY_PUBLIC_ACCESS/);
  assert.match(authSource, /role: "operator"/);
  assert.match(authSource, /if \(email !== getBootstrapAdminEmail\(\)\) return null/);
  assert.match(accessSource, /cf-access-jwt-assertion/);
  assert.match(accessSource, /createRemoteJWKSet/);
  assert.match(accessSource, /issuer: teamDomain/);
  assert.match(accessSource, /audience/);
  assert.match(apiSource, /payload\.action === "inviteUser"/);
  assert.match(apiSource, /payload\.action === "toggleUser"/);
  assert.match(csvTemplate, /No\. de Serie/);
  assert.match(csvTemplate, /Cantidad/);
  assert.match(csvTemplate, /MAC Address/);
});

test("maps the warehouse CSV and preserves rows that need manual serial correction", async () => {
  const { mapInventoryCsv } = await import("../lib/inventory-csv.ts");
  const csv = `Inventario 2026;;;;;;;;
Item;"Código y
nombre de sala";Tipo de equipo;Modelo;Serie;"Estatus
(funcional o no funcional)";Fecha de inventario;"Entregado al cliente
(SI O NO)";
1;2302;PIN PAD;MOV25BC;2,23357E+23;NO FUNCIONAL;46240;;
2;;CABLE DE RED CANTIDAD 82 UNIDADES;CAP 6 UTP DE 25 ft.;;FUNCIONAL;;;`;

  const records = mapInventoryCsv(csv);
  assert.equal(records.length, 2);
  assert.equal(records[0].barcode, "2,23357E+23-PENDIENTE-1");
  assert.equal(records[0].storeReference, "2302");
  assert.equal(records[0].condition, "not_working");
  assert.equal(records[0].receivedAt, "2026-08-06");
  assert.equal(records[0].delivered, false);
  assert.equal(records[1].itemKind, "material");
  assert.equal(records[1].barcode, "MAT-2");
  assert.equal(records[1].deviceType, "CABLE DE RED");
  assert.equal(records[1].quantity, 82);
  assert.equal(records[1].receivedAt, "");
});

test("keeps the equipment dialog ready for continuous barcode capture", async () => {
  const appSource = await readFile(
    new URL("../app/InventoryApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /Captura continua activa/);
  assert.match(appSource, /barcodeInput\.current\?\.select\(\)/);
  assert.match(appSource, /Guardar y continuar/);
  assert.doesNotMatch(
    appSource.match(/const submitEquipment[\s\S]*?const revealCredential/)?.[0] ?? "",
    /setEditing\(null\)/,
  );
});

test("removes user administration from the application interface", async () => {
  const appSource = await readFile(
    new URL("../app/InventoryApp.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(appSource, /view === "users"/);
  assert.doesNotMatch(appSource, /Usuarios autorizados/);
  assert.doesNotMatch(appSource, /Autorizar usuario/);
});
