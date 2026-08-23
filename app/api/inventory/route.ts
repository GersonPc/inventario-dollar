import {
  asc,
  desc,
  eq,
  isNotNull,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  deviceModelProfiles,
  equipment,
  equipmentMovements,
  stores,
} from "@/db/schema";
import {
  canWrite,
  getInventoryUser,
} from "@/lib/inventory-auth";
import { decryptCredential, encryptCredential } from "@/lib/inventory-crypto";
import { getWriteAccessFailure } from "@/lib/write-access";

type EquipmentInput = {
  id?: number;
  barcode?: string;
  model?: string;
  deviceType?: string;
  itemKind?: "equipment" | "material";
  quantity?: number;
  receivedAt?: string;
  delivered?: boolean;
  condition?: "working" | "not_working" | "unknown";
  storeId?: number | null;
  storeNumber?: string;
  storeName?: string;
  storeReference?: string | null;
  deliveredAt?: string | null;
  isNetworkDevice?: boolean;
  macAddress?: string | null;
  ipAddress?: string | null;
  password?: string | null;
  notes?: string | null;
  sourceRow?: number;
};

type StoreInput = {
  id?: number;
  storeNumber?: string;
  name?: string;
  sourceRow?: number;
};

type ActionPayload = {
  action?: string;
  equipment?: EquipmentInput;
  records?: EquipmentInput[];
  storeRecords?: StoreInput[];
  equipmentId?: number;
  store?: StoreInput;
};

const validConditions = new Set(["working", "not_working", "unknown"]);
const validItemKinds = new Set(["equipment", "material"]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown): string | null {
  const result = clean(value);
  return result || null;
}

function normalizeMac(value: unknown): string | null {
  const result = clean(value).replace(/-/g, ":").toUpperCase();
  return result || null;
}

function itemKind(input: EquipmentInput): "equipment" | "material" {
  return validItemKinds.has(input.itemKind ?? "") ? input.itemKind! : "equipment";
}

function itemQuantity(input: EquipmentInput): number {
  const quantity = Number(input.quantity ?? 1);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

function inventoryCode(input: EquipmentInput): string {
  const code = clean(input.barcode);
  if (code) return code;
  return `MAT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function equipmentError(input: EquipmentInput): string | null {
  if (itemKind(input) === "equipment" && !clean(input.barcode)) {
    return "El No. de Serie es obligatorio para los equipos.";
  }
  if (!clean(input.model)) return "El modelo es obligatorio.";
  if (!clean(input.deviceType)) return "El tipo de equipo o material es obligatorio.";
  if (!Number.isInteger(Number(input.quantity ?? 1)) || Number(input.quantity ?? 1) < 1) {
    return "La cantidad debe ser un número entero mayor que cero.";
  }
  if (
    input.delivered &&
    !input.storeId &&
    !clean(input.storeNumber) &&
    !clean(input.storeReference)
  ) {
    return "Selecciona una tienda para marcar el equipo como entregado.";
  }
  return null;
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

async function resolveStoreId(
  input: EquipmentInput,
): Promise<number | null> {
  if (typeof input.storeId === "number" && Number.isFinite(input.storeId)) {
    return input.storeId;
  }

  const storeNumber = clean(input.storeNumber);
  const storeName = clean(input.storeName);
  const storeReference = clean(input.storeReference);
  if (!storeNumber) {
    if (!storeReference) return null;
    const db = getDb();
    const [store] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(
        /^\d+$/.test(storeReference)
          ? eq(stores.storeNumber, storeReference)
          : sql`lower(${stores.name}) = ${storeReference.toLowerCase()}`,
      )
      .limit(1);
    return store?.id ?? null;
  }
  if (!storeName) throw new Error(`Falta el nombre de la tienda ${storeNumber}.`);

  const db = getDb();
  await db
    .insert(stores)
    .values({ storeNumber, name: storeName })
    .onConflictDoUpdate({
      target: stores.storeNumber,
      set: { name: storeName, updatedAt: new Date().toISOString() },
    });
  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.storeNumber, storeNumber))
    .limit(1);
  return store?.id ?? null;
}

export async function GET() {
  try {
    const currentUser = await getInventoryUser();
    if (!currentUser || !currentUser.active) {
      return jsonError("Tu sesión no está activa o tu correo no está autorizado.", 401);
    }

    const db = getDb();
    const equipmentRows = await db
      .select({
        id: equipment.id,
        barcode: equipment.barcode,
        model: equipment.model,
        deviceType: equipment.deviceType,
        itemKind: equipment.itemKind,
        quantity: equipment.quantity,
        receivedAt: equipment.receivedAt,
        delivered: equipment.delivered,
        condition: equipment.condition,
        storeId: equipment.storeId,
        storeNumber: stores.storeNumber,
        storeName: stores.name,
        storeReference: equipment.storeReference,
        deliveredAt: equipment.deliveredAt,
        isNetworkDevice: equipment.isNetworkDevice,
        macAddress: equipment.macAddress,
        ipAddress: equipment.ipAddress,
        notes: equipment.notes,
        hasCredential: isNotNull(equipment.credentialCiphertext),
        createdAt: equipment.createdAt,
        updatedAt: equipment.updatedAt,
      })
      .from(equipment)
      .leftJoin(stores, eq(equipment.storeId, stores.id))
      .orderBy(desc(equipment.updatedAt), desc(equipment.id))
      .limit(5000);

    const storeRows = await db.select().from(stores).orderBy(asc(stores.storeNumber));
    const deviceModelRows = await db
      .select()
      .from(deviceModelProfiles)
      .orderBy(asc(deviceModelProfiles.deviceType), asc(deviceModelProfiles.model));
    return Response.json({
      currentUser: {
        id: currentUser.id,
        email: currentUser.email,
        displayName: currentUser.displayName,
        role: currentUser.role,
      },
      equipment: equipmentRows,
      stores: storeRows,
      deviceModels: deviceModelRows,
      users: [],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "No se pudo cargar el inventario.",
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await getInventoryUser();
    if (!currentUser || !currentUser.active) {
      return jsonError("Tu sesión no está activa o tu correo no está autorizado.", 401);
    }

    const writeAccessFailure = await getWriteAccessFailure(request);
    if (writeAccessFailure) return writeAccessFailure;

    const payload = (await request.json()) as ActionPayload;
    const db = getDb();
    const actorId = null;

    if (payload.action === "revealCredential") {
      if (currentUser.role !== "admin") {
        return jsonError("Solo un administrador puede ver contraseñas.", 403);
      }
      const equipmentId = Number(payload.equipmentId);
      const [row] = await db
        .select({ credential: equipment.credentialCiphertext })
        .from(equipment)
        .where(eq(equipment.id, equipmentId))
        .limit(1);
      if (!row?.credential) return Response.json({ password: null });
      return Response.json({ password: await decryptCredential(row.credential) });
    }

    if (!canWrite(currentUser.role)) {
      return jsonError("Tu rol permite consultar, pero no modificar datos.", 403);
    }

    if (payload.action === "deleteEquipment") {
      const equipmentId = Number(payload.equipmentId);
      if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
        return jsonError("Artículo inválido.");
      }
      const [existing] = await db
        .select({ barcode: equipment.barcode })
        .from(equipment)
        .where(eq(equipment.id, equipmentId))
        .limit(1);
      if (!existing) return jsonError("El artículo ya no existe.", 404);

      // La clave foránea de movimientos aplica ON DELETE CASCADE.
      await db.delete(equipment).where(eq(equipment.id, equipmentId));
      return Response.json({ ok: true, barcode: existing.barcode });
    }

    if (payload.action === "saveStore") {
      const input = payload.store ?? {};
      const storeNumber = clean(input.storeNumber);
      const name = clean(input.name);
      if (!storeNumber || !name) {
        return jsonError("El número y el nombre de tienda son obligatorios.");
      }
      if (storeNumber.length > 80 || name.length > 200) {
        return jsonError("El número o el nombre de tienda es demasiado largo.");
      }

      const storeId = Number(input.id);
      if (Number.isInteger(storeId) && storeId > 0) {
        const [existing] = await db
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1);
        if (!existing) return jsonError("La tienda ya no existe.", 404);

        const [numberConflict] = await db
          .select({ id: stores.id })
          .from(stores)
          .where(eq(stores.storeNumber, storeNumber))
          .limit(1);
        if (numberConflict && numberConflict.id !== storeId) {
          return jsonError(`Ya existe una tienda con el número ${storeNumber}.`, 409);
        }

        await db
          .update(stores)
          .set({ storeNumber, name, updatedAt: new Date().toISOString() })
          .where(eq(stores.id, storeId));
        return Response.json({ ok: true, id: storeId });
      }

      await db
        .insert(stores)
        .values({ storeNumber, name })
        .onConflictDoUpdate({
          target: stores.storeNumber,
          set: { name, updatedAt: new Date().toISOString() },
        });
      return Response.json({ ok: true });
    }

    if (payload.action === "importStores") {
      const records = Array.isArray(payload.storeRecords) ? payload.storeRecords : [];
      if (!records.length) return jsonError("El archivo no contiene tiendas.");
      if (records.length > 5000) {
        return jsonError("El archivo supera el límite de 5,000 tiendas.");
      }

      let createdCount = 0;
      let updatedCount = 0;
      let unchangedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];
      const seenStoreNumbers = new Set<string>();

      for (let index = 0; index < records.length; index += 1) {
        const input = records[index];
        const storeNumber = clean(input.storeNumber);
        const name = clean(input.name);
        const rowNumber = input.sourceRow ?? index + 2;

        if (!storeNumber || !name) {
          skippedCount += 1;
          if (errors.length < 20) {
            errors.push(`Fila ${rowNumber}: el número y el nombre de tienda son obligatorios.`);
          }
          continue;
        }
        if (storeNumber.length > 80 || name.length > 200) {
          skippedCount += 1;
          if (errors.length < 20) {
            errors.push(`Fila ${rowNumber}: el número o el nombre de tienda es demasiado largo.`);
          }
          continue;
        }
        if (seenStoreNumbers.has(storeNumber)) {
          skippedCount += 1;
          if (errors.length < 20) {
            errors.push(`Fila ${rowNumber}: la tienda ${storeNumber} está repetida en el archivo.`);
          }
          continue;
        }
        seenStoreNumbers.add(storeNumber);

        try {
          const [existing] = await db
            .select({ id: stores.id, name: stores.name })
            .from(stores)
            .where(eq(stores.storeNumber, storeNumber))
            .limit(1);

          if (!existing) {
            await db.insert(stores).values({ storeNumber, name });
            createdCount += 1;
          } else if (existing.name !== name) {
            await db
              .update(stores)
              .set({ name, updatedAt: new Date().toISOString() })
              .where(eq(stores.id, existing.id));
            updatedCount += 1;
          } else {
            unchangedCount += 1;
          }
        } catch (error) {
          skippedCount += 1;
          if (errors.length < 20) {
            errors.push(
              `Fila ${rowNumber}: ${error instanceof Error ? error.message : "error inesperado"}`,
            );
          }
        }
      }

      return Response.json({
        createdCount,
        updatedCount,
        unchangedCount,
        skippedCount,
        errors,
      });
    }

    if (payload.action === "saveEquipment") {
      const input = payload.equipment ?? {};
      const validationError = equipmentError(input);
      if (validationError) return jsonError(validationError);
      const storeId = await resolveStoreId(input);
      const now = new Date().toISOString();
      const kind = itemKind(input);
      const values = {
        barcode: inventoryCode(input),
        model: clean(input.model),
        deviceType: clean(input.deviceType),
        itemKind: kind,
        quantity: kind === "equipment" ? 1 : itemQuantity(input),
        receivedAt: clean(input.receivedAt),
        delivered: Boolean(input.delivered),
        condition: validConditions.has(input.condition ?? "")
          ? input.condition!
          : ("unknown" as const),
        storeId,
        storeReference: storeId ? null : nullable(input.storeReference),
        deliveredAt: input.delivered
          ? nullable(input.deliveredAt) ?? now.slice(0, 10)
          : null,
        isNetworkDevice: kind === "equipment" && Boolean(input.isNetworkDevice),
        macAddress: normalizeMac(input.macAddress),
        ipAddress: nullable(input.ipAddress),
        notes: nullable(input.notes),
        updatedBy: actorId,
        updatedAt: now,
      };

      const inputId = Number(input.id);
      if (Number.isFinite(inputId) && inputId > 0) {
        const [before] = await db
          .select()
          .from(equipment)
          .where(eq(equipment.id, inputId))
          .limit(1);
        if (!before) return jsonError("El equipo ya no existe.", 404);
        const credentialCiphertext = clean(input.password)
          ? await encryptCredential(clean(input.password))
          : before.credentialCiphertext;
        await db
          .update(equipment)
          .set({ ...values, credentialCiphertext })
          .where(eq(equipment.id, inputId));
        const movementAction =
          !before.delivered && values.delivered
            ? "delivered"
            : before.delivered && !values.delivered
              ? "returned"
              : "updated";
        await db.insert(equipmentMovements).values({
          equipmentId: inputId,
          action: movementAction,
          storeId,
          actorId,
          details: JSON.stringify({ barcode: values.barcode }),
        });
        return Response.json({ ok: true, id: inputId });
      }

      const credentialCiphertext = clean(input.password)
        ? await encryptCredential(clean(input.password))
        : null;
      const [created] = await db
        .insert(equipment)
        .values({
          ...values,
          credentialCiphertext,
          createdBy: actorId,
        })
        .returning({ id: equipment.id });
      await db.insert(equipmentMovements).values({
        equipmentId: created.id,
        action: values.delivered ? "delivered" : "received",
        storeId,
        actorId,
        details: JSON.stringify({ barcode: values.barcode }),
      });
      return Response.json({ ok: true, id: created.id }, { status: 201 });
    }

    if (payload.action === "importCsv") {
      const records = Array.isArray(payload.records) ? payload.records.slice(0, 5000) : [];
      if (!records.length) return jsonError("El archivo no contiene registros.");

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (let index = 0; index < records.length; index += 1) {
        const input = records[index];
        const validationError = equipmentError(input);
        if (validationError) {
          skippedCount += 1;
          if (errors.length < 20) {
            errors.push(`Fila ${input.sourceRow ?? index + 2}: ${validationError}`);
          }
          continue;
        }

        try {
          const storeId = await resolveStoreId(input);
          const kind = itemKind(input);
          const barcode = inventoryCode(input);
          const [existing] = await db
            .select()
            .from(equipment)
            .where(eq(equipment.barcode, barcode))
            .limit(1);
          const password = clean(input.password);
          const credentialCiphertext = password
            ? await encryptCredential(password)
            : existing?.credentialCiphertext ?? null;
          const now = new Date().toISOString();
          const recordValues = {
            barcode,
            model: clean(input.model),
            deviceType: clean(input.deviceType),
            itemKind: kind,
            quantity: kind === "equipment" ? 1 : itemQuantity(input),
            receivedAt: clean(input.receivedAt),
            delivered: Boolean(input.delivered),
            condition: validConditions.has(input.condition ?? "")
              ? input.condition!
              : ("unknown" as const),
            storeId,
            storeReference: storeId ? null : nullable(input.storeReference),
            deliveredAt: input.delivered
              ? nullable(input.deliveredAt) ?? now.slice(0, 10)
              : null,
            isNetworkDevice:
              kind === "equipment" &&
              (Boolean(input.isNetworkDevice) ||
                Boolean(clean(input.macAddress) || clean(input.ipAddress) || password)),
            macAddress: normalizeMac(input.macAddress),
            ipAddress: nullable(input.ipAddress),
            credentialCiphertext,
            notes: nullable(input.notes),
            updatedBy: actorId,
            updatedAt: now,
          };

          let equipmentId: number;
          if (existing) {
            await db
              .update(equipment)
              .set(recordValues)
              .where(eq(equipment.id, existing.id));
            equipmentId = existing.id;
            updatedCount += 1;
          } else {
            const [created] = await db
              .insert(equipment)
              .values({ ...recordValues, createdBy: actorId })
              .returning({ id: equipment.id });
            equipmentId = created.id;
            createdCount += 1;
          }

          await db.insert(equipmentMovements).values({
            equipmentId,
            action: "imported",
            storeId,
            actorId,
            details: JSON.stringify({ row: input.sourceRow ?? index + 2 }),
          });
        } catch (error) {
          skippedCount += 1;
          if (errors.length < 20) {
            errors.push(
              `Fila ${input.sourceRow ?? index + 2}: ${error instanceof Error ? error.message : "error inesperado"}`,
            );
          }
        }
      }

      return Response.json({ createdCount, updatedCount, skippedCount, errors });
    }

    return jsonError("Acción no reconocida.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    const status = /UNIQUE constraint failed|unique/i.test(message) ? 409 : 500;
    return jsonError(
      status === 409 ? "El No. de Serie o código de material ya está registrado." : message,
      status,
    );
  }
}
