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

test("declares durable storage, protected credentials and closed user access", async () => {
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
  assert.match(schema, /idx_equipment_barcode_unique/);
  assert.match(schema, /equipmentMovements/);
  assert.match(cryptoSource, /AES-GCM/);
  assert.match(authSource, /INVENTORY_ADMIN_EMAIL/);
  assert.match(authSource, /if \(email !== getBootstrapAdminEmail\(\)\) return null/);
  assert.match(accessSource, /cf-access-jwt-assertion/);
  assert.match(accessSource, /createRemoteJWKSet/);
  assert.match(accessSource, /issuer: teamDomain/);
  assert.match(accessSource, /audience/);
  assert.match(apiSource, /payload\.action === "inviteUser"/);
  assert.match(apiSource, /payload\.action === "toggleUser"/);
  assert.match(csvTemplate, /Codigo de barras/);
  assert.match(csvTemplate, /MAC Address/);
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
