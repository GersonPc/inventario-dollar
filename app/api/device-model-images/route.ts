import { env } from "cloudflare:workers";
import { getInventoryUser } from "@/lib/inventory-auth";

function isDeviceImageKey(value: string): boolean {
  return /^device-models\/[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(value);
}

export async function GET(request: Request) {
  const currentUser = await getInventoryUser();
  if (!currentUser || !currentUser.active) {
    return Response.json(
      { error: "Tu sesión no está activa o tu correo no está autorizado." },
      { status: 401 },
    );
  }

  const key = new URL(request.url).searchParams.get("key")?.trim() ?? "";
  if (!isDeviceImageKey(key)) {
    return Response.json({ error: "Imagen inválida." }, { status: 400 });
  }

  const object = await env.DEVICE_IMAGES.get(key);
  if (!object) {
    return Response.json({ error: "La imagen no existe." }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  if (request.headers.get("if-none-match") === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}
