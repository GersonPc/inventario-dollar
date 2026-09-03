import { env } from "cloudflare:workers";
import { deviceModelCatalogKey } from "@/lib/device-models";

type Condition = "working" | "not_working" | "unknown";

type ReplacementRecord = {
  barcode: string;
  model: string;
  deviceType: string;
  receivedAt: string;
  delivered: boolean;
  condition: Condition;
  storeReference: string | null;
  notes: string | null;
  sourceItem: string;
};

type ReplacementProfile = {
  deviceType: string;
  model: string;
  imagePath: string;
};

type ReplacementPayload = {
  records?: ReplacementRecord[];
  profiles?: ReplacementProfile[];
};

type ImportEnvironment = Cloudflare.Env & {
  INVENTORY_IMPORT_TOKEN?: string;
};

const expectedSummary = new Map([
  ["CASHAWARE", 11],
  ["CPU´S", 4],
  ["DISCOS PORTABLES", 1],
  ["PANTALLA NCR", 1],
  ["PANTALLAS  eLO", 4],
  ["PIN PAD", 52],
  ["PRINTER DE FACTURACION", 120],
  ["SCANER DE MESA", 6],
  ["ups", 57],
]);

const validConditions = new Set<Condition>([
  "working",
  "not_working",
  "unknown",
]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function tokenMatches(candidate: string): Promise<boolean> {
  const expected = (env as ImportEnvironment).INVENTORY_IMPORT_TOKEN ?? "";
  if (expected.length < 32 || !candidate) return false;
  const encoder = new TextEncoder();
  const [expectedHash, candidateHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
  ]);
  return crypto.subtle.timingSafeEqual(expectedHash, candidateHash);
}

function validateRecords(records: ReplacementRecord[]): string | null {
  if (records.length !== 256) {
    return `Se esperaban 256 registros y se recibieron ${records.length}.`;
  }

  const barcodes = new Set<string>();
  const summary = new Map<string, number>();
  for (const [index, record] of records.entries()) {
    const barcode = clean(record.barcode);
    const model = clean(record.model);
    const deviceType = clean(record.deviceType);
    if (!barcode || !model || !deviceType) {
      return `El registro ${index + 1} no tiene serie, modelo o tipo.`;
    }
    if (barcodes.has(barcode)) {
      return `La serie o código ${barcode} está repetido.`;
    }
    if (!validConditions.has(record.condition)) {
      return `La condición del registro ${index + 1} no es válida.`;
    }
    if (record.receivedAt && !/^\d{4}-\d{2}-\d{2}$/.test(record.receivedAt)) {
      return `La fecha del registro ${index + 1} no es válida.`;
    }
    barcodes.add(barcode);
    summary.set(deviceType, (summary.get(deviceType) ?? 0) + 1);
  }

  if (summary.size !== expectedSummary.size) {
    return "El número de categorías no coincide con el resumen esperado.";
  }
  for (const [deviceType, count] of expectedSummary) {
    if (summary.get(deviceType) !== count) {
      return `La categoría ${deviceType} no coincide con el resumen esperado.`;
    }
  }
  return null;
}

function validateProfiles(profiles: ReplacementProfile[]): string | null {
  if (profiles.length > 20) return "Se recibieron demasiadas fotografías.";
  for (const profile of profiles) {
    if (!clean(profile.deviceType) || !clean(profile.model)) {
      return "Una fotografía no tiene tipo o modelo.";
    }
    if (!/^\/inventory-models\/[a-z0-9-]+\.png$/.test(profile.imagePath)) {
      return "Una fotografía tiene una ruta inválida.";
    }
  }
  return null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1024 * 1024) {
    return jsonError("La solicitud supera el tamaño permitido.", 413);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!(await tokenMatches(candidate))) {
    return jsonError("La importación no está habilitada.", 401);
  }

  let payload: ReplacementPayload;
  try {
    payload = (await request.json()) as ReplacementPayload;
  } catch {
    return jsonError("La solicitud no contiene JSON válido.");
  }

  const records = Array.isArray(payload.records) ? payload.records : [];
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
  const recordError = validateRecords(records);
  if (recordError) return jsonError(recordError);
  const profileError = validateProfiles(profiles);
  if (profileError) return jsonError(profileError);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM equipment_movements"),
    env.DB.prepare("DELETE FROM device_model_profiles"),
    env.DB.prepare("DELETE FROM equipment"),
    env.DB.prepare(
      "DELETE FROM sqlite_sequence WHERE name IN ('equipment', 'equipment_movements', 'device_model_profiles')",
    ),
  ];

  for (const record of records) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO equipment (
          barcode, model, device_type, item_kind, quantity, received_at,
          delivered, condition, store_id, store_reference, delivered_at,
          is_network_device, mac_address, ip_address, credential_ciphertext,
          notes, created_by, updated_by
        ) VALUES (?, ?, ?, 'equipment', 1, ?, ?, ?, NULL, ?, NULL, 0, NULL, NULL, NULL, ?, NULL, NULL)`,
      ).bind(
        clean(record.barcode),
        clean(record.model),
        clean(record.deviceType),
        clean(record.receivedAt),
        record.delivered ? 1 : 0,
        record.condition,
        clean(record.storeReference) || null,
        clean(record.notes) || null,
      ),
    );
  }

  for (const profile of profiles) {
    const deviceType = clean(profile.deviceType);
    const model = clean(profile.model);
    statements.push(
      env.DB.prepare(
        `INSERT INTO device_model_profiles (
          catalog_key, device_type, model, description, image_key,
          image_content_type, updated_by
        ) VALUES (?, ?, ?, ?, ?, 'image/png', NULL)`,
      ).bind(
        deviceModelCatalogKey(deviceType, model),
        deviceType,
        model,
        "Fotografía tomada del archivo de inventario recibido.",
        profile.imagePath,
      ),
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO equipment_movements (equipment_id, action, store_id, details, actor_id)
       SELECT id, 'imported', store_id, json_object('source', 'Inventario 2026'), NULL
       FROM equipment`,
    ),
  );

  try {
    await env.DB.batch(statements);
    const [totalsResult, summaryResult] = await env.DB.batch([
      env.DB.prepare(
        "SELECT COUNT(*) AS records, COALESCE(SUM(quantity), 0) AS units FROM equipment",
      ),
      env.DB.prepare(
        `SELECT device_type AS deviceType, COALESCE(SUM(quantity), 0) AS units
         FROM equipment
         WHERE item_kind = 'equipment'
         GROUP BY device_type
         ORDER BY device_type`,
      ),
    ]);
    return Response.json({
      ok: true,
      totals: totalsResult.results[0],
      summary: summaryResult.results,
      photographs: profiles.length,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "No se pudo reemplazar el inventario.",
      500,
    );
  }
}
