import {
  isWriteAccessConfigured,
  issueWriteAccessToken,
  passwordMatches,
  writeAccessMinutes,
  writeAccessNotConfiguredCode,
} from "@/lib/write-access";

function jsonError(message: string, code: string, status: number) {
  return Response.json(
    { error: message, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return jsonError("Solicitud no permitida.", "INVALID_ORIGIN", 403);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2048) {
    return jsonError("La solicitud es demasiado grande.", "INVALID_REQUEST", 413);
  }
  if (!isWriteAccessConfigured()) {
    return jsonError(
      "La clave de edición todavía no está configurada en el servidor.",
      writeAccessNotConfiguredCode,
      503,
    );
  }

  let password = "";
  try {
    const payload = (await request.json()) as { password?: unknown };
    password = typeof payload.password === "string" ? payload.password : "";
  } catch {
    return jsonError("Solicitud inválida.", "INVALID_REQUEST", 400);
  }
  if (password.length > 512 || !(await passwordMatches(password))) {
    return jsonError("La clave de edición no es correcta.", "INVALID_PASSWORD", 401);
  }

  const access = await issueWriteAccessToken();
  return Response.json(
    {
      token: access.token,
      expiresAt: access.expiresAt,
      expiresInMinutes: writeAccessMinutes(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
