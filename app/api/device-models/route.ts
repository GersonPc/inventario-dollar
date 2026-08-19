import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deviceModelProfiles } from "@/db/schema";
import { deviceModelCatalogKey } from "@/lib/device-models";
import {
  canWrite,
  getInventoryUser,
} from "@/lib/inventory-auth";
import { getWriteAccessFailure } from "@/lib/write-access";

const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maximumImageBytes = 5 * 1024 * 1024;

function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: string): string | null {
  return value || null;
}

function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function matchesImageSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  }
  if (contentType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
      && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  let uploadedImageKey: string | null = null;

  try {
    const currentUser = await getInventoryUser();
    if (!currentUser || !currentUser.active) {
      return jsonError("Tu sesión no está activa o tu correo no está autorizado.", 401);
    }
    const writeAccessFailure = await getWriteAccessFailure(request);
    if (writeAccessFailure) return writeAccessFailure;
    if (!canWrite(currentUser.role)) {
      return jsonError("Tu rol permite consultar, pero no editar fichas.", 403);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > maximumImageBytes + 512 * 1024) {
      return jsonError("La solicitud supera el tamaño permitido.", 413);
    }

    const formData = await request.formData();
    const deviceType = textField(formData, "deviceType");
    const model = textField(formData, "model");
    const manufacturer = textField(formData, "manufacturer");
    const description = textField(formData, "description");
    const specifications = textField(formData, "specifications");
    const removeImage = textField(formData, "removeImage") === "true";

    if (!deviceType || !model) {
      return jsonError("El tipo de dispositivo y el modelo son obligatorios.");
    }
    if (manufacturer.length > 150) return jsonError("La marca es demasiado larga.");
    if (description.length > 2000) return jsonError("La descripción es demasiado larga.");
    if (specifications.length > 5000) {
      return jsonError("Las especificaciones son demasiado largas.");
    }

    const catalogKey = deviceModelCatalogKey(deviceType, model);
    const db = getDb();
    const updatedBy = null;
    const [existing] = await db
      .select()
      .from(deviceModelProfiles)
      .where(eq(deviceModelProfiles.catalogKey, catalogKey))
      .limit(1);

    const imageCandidate = formData.get("image");
    const image = imageCandidate instanceof File && imageCandidate.size > 0
      ? imageCandidate
      : null;
    let imageKey = removeImage ? null : existing?.imageKey ?? null;
    let imageContentType = removeImage
      ? null
      : existing?.imageContentType ?? null;

    if (image) {
      const extension = allowedImageTypes.get(image.type);
      if (!extension) {
        return jsonError("La imagen debe ser JPG, PNG o WebP.");
      }
      if (image.size > maximumImageBytes) {
        return jsonError("La imagen no puede superar 5 MB.");
      }

      uploadedImageKey = `device-models/${crypto.randomUUID()}.${extension}`;
      const imageBytes = new Uint8Array(await image.arrayBuffer());
      if (!matchesImageSignature(imageBytes, image.type)) {
        return jsonError("El contenido del archivo no corresponde a una imagen válida.");
      }
      await env.DEVICE_IMAGES.put(uploadedImageKey, imageBytes, {
        httpMetadata: {
          contentType: image.type,
          cacheControl: "private, max-age=3600",
        },
      });
      imageKey = uploadedImageKey;
      imageContentType = image.type;
    }

    const now = new Date().toISOString();
    await db
      .insert(deviceModelProfiles)
      .values({
        catalogKey,
        deviceType,
        model,
        manufacturer: nullable(manufacturer),
        description: nullable(description),
        specifications: nullable(specifications),
        imageKey,
        imageContentType,
        updatedBy,
      })
      .onConflictDoUpdate({
        target: deviceModelProfiles.catalogKey,
        set: {
          deviceType,
          model,
          manufacturer: nullable(manufacturer),
          description: nullable(description),
          specifications: nullable(specifications),
          imageKey,
          imageContentType,
          updatedBy,
          updatedAt: now,
        },
      });

    uploadedImageKey = null;

    if (existing?.imageKey && existing.imageKey !== imageKey) {
      await env.DEVICE_IMAGES.delete(existing.imageKey).catch(() => undefined);
    }

    const [profile] = await db
      .select()
      .from(deviceModelProfiles)
      .where(eq(deviceModelProfiles.catalogKey, catalogKey))
      .limit(1);
    return Response.json({ ok: true, profile });
  } catch (error) {
    if (uploadedImageKey) {
      await env.DEVICE_IMAGES.delete(uploadedImageKey).catch(() => undefined);
    }
    return jsonError(
      error instanceof Error ? error.message : "No se pudo guardar la ficha del dispositivo.",
      500,
    );
  }
}
