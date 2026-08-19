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

test("declares durable storage, protected credentials and shared write access", async () => {
  const [hosting, wrangler, schema, cryptoSource, authSource, writeAccessSource, writeAccessApi, apiSource, csvTemplate] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/inventory-crypto.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/inventory-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/write-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/write-access/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/inventory/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/plantilla-inventario.csv", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(hosting, /"r2":\s*"DEVICE_IMAGES"/);
  assert.match(wrangler, /"binding":\s*"DB"/);
  assert.match(wrangler, /"binding":\s*"DEVICE_IMAGES"/);
  assert.match(wrangler, /"INVENTORY_WRITE_ACCESS_MINUTES":\s*"30"/);
  assert.doesNotMatch(wrangler, /CF_ACCESS|INVENTORY_PUBLIC_ACCESS/);
  assert.match(schema, /idx_equipment_barcode_unique/);
  assert.match(schema, /itemKind/);
  assert.match(schema, /quantity/);
  assert.match(schema, /storeReference/);
  assert.match(schema, /isNetworkDevice/);
  assert.match(schema, /equipmentMovements/);
  assert.match(schema, /deviceModelProfiles/);
  assert.match(schema, /idx_device_model_profiles_catalog_key_unique/);
  assert.match(cryptoSource, /AES-GCM/);
  assert.match(authSource, /Consulta pública/);
  assert.match(authSource, /role: "operator"/);
  assert.doesNotMatch(authSource, /getChatGPTUser|Cloudflare Access/);
  assert.match(writeAccessSource, /INVENTORY_WRITE_PASSWORD/);
  assert.match(writeAccessSource, /timingSafeEqual/);
  assert.match(writeAccessSource, /HMAC/);
  assert.match(writeAccessSource, /expiresAt > Date\.now\(\)/);
  assert.match(writeAccessApi, /passwordMatches/);
  assert.match(writeAccessApi, /cache-control/);
  assert.match(apiSource, /getWriteAccessFailure\(request\)/);
  assert.match(apiSource, /payload\.action === "deleteEquipment"/);
  assert.match(apiSource, /db\.delete\(equipment\)/);
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

test("maps a store catalog CSV exported from Excel", async () => {
  const { mapStoresCsv } = await import("../lib/inventory-csv.ts");
  const csv = `Listado oficial de tiendas;;
No. de Tienda;Nombre de tienda
0012;Dollar Centro
2302;Dollar Zona Norte`;

  const records = mapStoresCsv(csv);
  assert.deepEqual(records, [
    { storeNumber: "0012", name: "Dollar Centro", sourceRow: 3 },
    { storeNumber: "2302", name: "Dollar Zona Norte", sourceRow: 4 },
  ]);
});

test("provides a dedicated store list import with preview and safe upserts", async () => {
  const [appSource, apiSource, storeTemplate] = await Promise.all([
    readFile(new URL("../app/InventoryApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/inventory/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/plantilla-tiendas.csv", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /Subir listado de tiendas/);
  assert.match(appSource, /Vista previa del listado/);
  assert.match(appSource, /Descargar plantilla/);
  assert.match(appSource, /action: "importStores"/);
  assert.match(apiSource, /payload\.action === "importStores"/);
  assert.match(apiSource, /updatedCount/);
  assert.match(apiSource, /unchangedCount/);
  assert.match(storeTemplate, /No\. de Tienda;Nombre de tienda/);
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

test("exports filtered CSV records and supports a phone camera barcode scanner", async () => {
  const [appSource, packageSource] = await Promise.all([
    readFile(new URL("../app/InventoryApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /Exportar CSV/);
  assert.match(appSource, /Las contraseñas no se incluyen/);
  assert.doesNotMatch(appSource, /exportCredentials/);
  assert.match(appSource, /Generar reporte/);
  assert.match(appSource, /reportWindow\.print\(\)/);
  assert.match(appSource, /decodeFromConstraints/);
  assert.match(appSource, /facingMode: \{ ideal: "environment" \}/);
  assert.match(appSource, /Usar cámara/);
  assert.match(packageSource, /"@zxing\/browser"/);
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

test("keeps write permission only in memory and asks for the shared password", async () => {
  const appSource = await readFile(
    new URL("../app/InventoryApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /Habilitar edición/);
  assert.match(appSource, /Ingresa la clave de edición/);
  assert.match(appSource, /writeToken = useRef/);
  assert.match(appSource, /authorization: `Bearer \$\{accessToken\}`/);
  assert.match(appSource, /30 minutos o hasta recargar/);
  assert.doesNotMatch(appSource, /localStorage|sessionStorage/);
});

test("allows a writable user to delete an existing item from its edit dialog", async () => {
  const appSource = await readFile(
    new URL("../app/InventoryApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /const deleteEquipment/);
  assert.match(appSource, /Eliminar artículo/);
  assert.match(appSource, /Esta acción no se puede deshacer/);
});

test("shows network fields only when the device is marked for network use", async () => {
  const appSource = await readFile(
    new URL("../app/InventoryApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(appSource, /Es un dispositivo de red/);
  assert.match(appSource, /editing\.isNetworkDevice \? <FormField label="MAC Address"/);
  assert.match(appSource, /editing\.isNetworkDevice \? <FormField label="Dirección IP"/);
  assert.match(appSource, /Dispositivo de red/);
});

test("provides editable device model profiles with R2 image uploads", async () => {
  const [appSource, profileApi, imageApi] = await Promise.all([
    readFile(new URL("../app/InventoryApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/device-models/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/device-model-images/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /label: "Dispositivos"/);
  assert.match(appSource, /Editar ficha/);
  assert.match(appSource, /Subir imagen/);
  assert.match(appSource, /Información técnica/);
  assert.match(profileApi, /env\.DEVICE_IMAGES\.put/);
  assert.match(profileApi, /getWriteAccessFailure\(request\)/);
  assert.match(profileApi, /const updatedBy = null/);
  assert.match(profileApi, /maximumImageBytes = 5 \* 1024 \* 1024/);
  assert.match(imageApi, /env\.DEVICE_IMAGES\.get/);
  assert.match(imageApi, /x-content-type-options/);
});

test("does not write the shared public identity into user foreign keys", async () => {
  const apiSource = await readFile(
    new URL("../app/api/inventory/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(apiSource, /const actorId = null/);
  assert.match(apiSource, /createdBy: actorId/);
  assert.match(apiSource, /updatedBy: actorId/);
  assert.match(apiSource, /actorId,/);
});
