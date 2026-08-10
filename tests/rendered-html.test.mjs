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

test("declares durable inventory storage and protected credentials", async () => {
  const [hosting, schema, cryptoSource, csvTemplate] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/inventory-crypto.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/plantilla-inventario.csv", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(schema, /idx_equipment_barcode_unique/);
  assert.match(schema, /equipmentMovements/);
  assert.match(cryptoSource, /AES-GCM/);
  assert.match(csvTemplate, /Codigo de barras/);
  assert.match(csvTemplate, /MAC Address/);
});
