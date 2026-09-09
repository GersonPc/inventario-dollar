import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

// El emulador que migra SQLite debe coincidir con el usado por Vite.
const viteRequire = createRequire(import.meta.resolve("@cloudflare/vite-plugin"));
const cli = resolve(dirname(viteRequire.resolve("wrangler")), "../bin/wrangler.js");
const result = spawnSync(process.execPath, [
  cli, "d1", "migrations", "apply", "DB", "--local", "--config", "wrangler.local.json",
], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
