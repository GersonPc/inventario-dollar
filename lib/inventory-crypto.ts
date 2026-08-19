import { env } from "cloudflare:workers";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getEncryptionSecret(): string {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const secret = runtimeEnv.INVENTORY_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 24) {
    throw new Error(
      "La clave de cifrado de credenciales no está configurada correctamente.",
    );
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(getEncryptionSecret()),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encryptCredential(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await getKey(),
    encoder.encode(value),
  );
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);
  return bytesToBase64(payload);
}

export async function decryptCredential(value: string): Promise<string> {
  const payload = base64ToBytes(value);
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    await getKey(),
    ciphertext,
  );
  return decoder.decode(decrypted);
}
