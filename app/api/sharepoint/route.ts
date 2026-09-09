import { env } from "cloudflare:workers";
import { getWriteAccessFailure } from "@/lib/write-access";
import { getInventoryUser, canWrite } from "@/lib/inventory-auth";
import { downloadSharePointWorkbook, readBounded, sharePointConfigured, sharePointSource } from "@/lib/sharepoint-source";
import { readSourceWorkbook } from "@/lib/sharepoint-workbook";
import { applySync, prepareSync, type SyncPreview } from "@/lib/sharepoint-sync";
import type { SyncChoice } from "@/lib/sharepoint-plan";

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  return json({ configured: sharePointConfigured(env), mode: "read-only", sourceUrl: sharePointSource.url });
}

export async function POST(request: Request) {
  const currentUser = await getInventoryUser();
  if (!currentUser?.active || !canWrite(currentUser.role)) return json({ error: "Acceso no autorizado." }, 403);
  const failure = await getWriteAccessFailure(request);
  if (failure) return failure;
  try {
    const isFile = request.headers.get("content-type") === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const uploadedBytes = isFile ? await readBounded(new Response(request.body), 5 * 1024 * 1024) : null;
    const body = (isFile ? { action: "preview", choices: JSON.parse(request.headers.get("x-sync-choices") ?? "{}") } : JSON.parse(new TextDecoder().decode(await readBounded(new Response(request.body), 128_000)))) as {
      action?: string; previewId?: string; choices?: Record<string, SyncChoice>;
    };
    if (body.action !== "preview" && body.action !== "apply") return json({ error: "Acción no reconocida." }, 400);
    if (body.action === "apply") {
      if (typeof body.previewId !== "string" || body.previewId.length > 80) return json({ error: "Vista previa inválida." }, 400);
      const stored = await env.DB.prepare("SELECT payload FROM sharepoint_previews WHERE id = ? AND consumed = 0 AND expires_at > ?")
        .bind(body.previewId, Date.now()).first<{ payload: string }>();
      if (!stored) return json({ error: "La vista previa venció o ya fue aplicada. Consulta el archivo nuevamente." }, 409);
      const preview = JSON.parse(stored.payload) as SyncPreview;
      if (preview.origin === "sharepoint") {
        const workbook = await downloadSharePointWorkbook(env);
        if (preview.version !== workbook.version) return json({ error: "El Excel cambió después de la vista previa. Consúltalo nuevamente." }, 409);
      }
      return json(await applySync(env.DB, body.previewId, preview));
    }
    const choices = body.choices ?? {};
    if (typeof choices !== "object" || choices === null || Array.isArray(choices) || Object.entries(choices).some(([item, choice]) =>
      !/^\d+$/.test(item) || (choice !== "create" && choice !== "skip" && (typeof choice !== "number" || !Number.isInteger(choice) || choice <= 0)))) {
      return json({ error: "Selección de equipos inválida." }, 400);
    }
    const workbook = uploadedBytes ? {
      bytes: uploadedBytes,
      version: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(uploadedBytes)))).map((b) => b.toString(16).padStart(2, "0")).join(""),
    } : await downloadSharePointWorkbook(env);
    const parsed = await readSourceWorkbook(workbook.bytes);
    const preview = await prepareSync(env.DB, parsed.rows, workbook.version, choices, uploadedBytes ? "file" : "sharepoint");
    const previewId = crypto.randomUUID();
    const expiresAt = Date.now() + 10 * 60_000;
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sharepoint_previews WHERE expires_at < ?").bind(Date.now()),
      env.DB.prepare("INSERT INTO sharepoint_previews(id, payload, expires_at) VALUES (?, ?, ?)")
        .bind(previewId, JSON.stringify(preview), expiresAt),
    ]);
    const sourceItems = new Set(parsed.rows.map((row) => row.item));
    return json({
      previewId, expiresAt, origin: preview.origin, plan: preview.plan, summary: parsed.summary, summaryTotal: parsed.summaryTotal,
      summaryMatches: parsed.summaryMatches, warnings: parsed.warnings,
      absent: preview.links.filter((link) => !sourceItems.has(link.item)).map((link) => link.item),
      equipment: preview.locals.filter((row) => row.itemKind === "equipment").map(({ id, barcode, model, deviceType }) => ({ id, barcode, model, deviceType })),
    });
  } catch (error) {
    // Never return raw Microsoft response bodies, URLs with download tokens, or secrets.
    const message = error instanceof Error ? error.message : "No se pudo consultar SharePoint.";
    if (/D1_|SQLITE_|no such table|Database/i.test(message)) return json({ error: "La conexión necesita la actualización de la base de datos del servidor." }, 503);
    return json({ error: message }, 400);
  }
}
