import { env } from "cloudflare:workers";

export const writeAccessRequiredCode = "WRITE_ACCESS_REQUIRED";
export const writeAccessNotConfiguredCode = "WRITE_ACCESS_NOT_CONFIGURED";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const minimumPasswordLength = 12;
const defaultAccessMinutes = 30;
const maximumAccessMinutes = 8 * 60;

type WriteAccessClaims = {
  version: 1;
  expiresAt: number;
  nonce: string;
};

function configuredPassword(): string {
  return env.INVENTORY_WRITE_PASSWORD ?? "";
}

export function writeAccessMinutes(): number {
  const configured = Number(env.INVENTORY_WRITE_ACCESS_MINUTES ?? defaultAccessMinutes);
  if (!Number.isFinite(configured)) return defaultAccessMinutes;
  return Math.min(maximumAccessMinutes, Math.max(5, Math.round(configured)));
}

export function isWriteAccessConfigured(): boolean {
  return configuredPassword().length >= minimumPasswordLength;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function passwordHash(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(value));
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const password = configuredPassword();
  if (password.length < minimumPasswordLength || !candidate) return false;
  const [expectedHash, candidateHash] = await Promise.all([
    passwordHash(password),
    passwordHash(candidate),
  ]);
  return crypto.subtle.timingSafeEqual(expectedHash, candidateHash);
}

async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(configuredPassword()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function issueWriteAccessToken(): Promise<{
  token: string;
  expiresAt: number;
}> {
  if (!isWriteAccessConfigured()) {
    throw new Error("La clave de edición no está configurada.");
  }
  const expiresAt = Date.now() + writeAccessMinutes() * 60_000;
  const claims: WriteAccessClaims = {
    version: 1,
    expiresAt,
    nonce: crypto.randomUUID(),
  };
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    encoder.encode(payload),
  );
  return {
    token: `${payload}.${base64UrlEncode(new Uint8Array(signature))}`,
    expiresAt,
  };
}

export async function isValidWriteAccessToken(token: string): Promise<boolean> {
  if (!isWriteAccessConfigured()) return false;
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return false;

  try {
    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      base64UrlDecode(encodedSignature),
      encoder.encode(payload),
    );
    if (!signatureValid) return false;
    const claims = JSON.parse(
      decoder.decode(base64UrlDecode(payload)),
    ) as Partial<WriteAccessClaims>;
    return (
      claims.version === 1 &&
      typeof claims.expiresAt === "number" &&
      Number.isFinite(claims.expiresAt) &&
      claims.expiresAt > Date.now() &&
      typeof claims.nonce === "string" &&
      claims.nonce.length > 0
    );
  } catch {
    return false;
  }
}

export async function getWriteAccessFailure(
  request: Request,
): Promise<Response | null> {
  if (!isWriteAccessConfigured()) {
    return Response.json(
      {
        error: "La clave de edición todavía no está configurada en el servidor.",
        code: writeAccessNotConfiguredCode,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!token || !(await isValidWriteAccessToken(token))) {
    return Response.json(
      {
        error: "Ingresa la clave de edición para guardar cambios.",
        code: writeAccessRequiredCode,
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  return null;
}
