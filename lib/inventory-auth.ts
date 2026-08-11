import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export type InventoryRole = "admin" | "operator" | "viewer";
type InventoryUser = typeof users.$inferSelect;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getBootstrapAdminEmail(): string {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  return normalizeEmail(runtimeEnv.INVENTORY_ADMIN_EMAIL ?? "");
}

/**
 * Temporary switch used while the Entra ID integration is being prepared.
 * Keep this disabled in every environment that is not intentionally public.
 */
export function isPublicAccessEnabled(): boolean {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  return runtimeEnv.INVENTORY_PUBLIC_ACCESS?.trim().toLowerCase() === "true";
}

function getPublicInventoryUser(): InventoryUser {
  return {
    id: "public-access",
    email: "public-access@inventory.local",
    displayName: "Acceso público temporal",
    // It can work with the inventory but cannot reveal stored passwords.
    role: "operator",
    active: true,
    createdAt: "",
    updatedAt: "",
  };
}

export async function getInventoryUser(): Promise<InventoryUser | null> {
  if (isPublicAccessEnabled()) return getPublicInventoryUser();

  const identity = await getChatGPTUser();
  if (!identity) return null;

  const db = getDb();
  const email = normalizeEmail(identity.email);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, identity.userId))
    .limit(1);

  if (existing) {
    if (
      existing.email !== email ||
      existing.displayName !== identity.displayName
    ) {
      await db
        .update(users)
        .set({
          email,
          displayName: identity.displayName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, identity.userId));
    }
    return { ...existing, email, displayName: identity.displayName };
  }

  const [authorized] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (authorized) {
    if (authorized.displayName !== identity.displayName) {
      await db
        .update(users)
        .set({
          displayName: identity.displayName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, authorized.id));
    }
    return { ...authorized, displayName: identity.displayName };
  }

  if (email !== getBootstrapAdminEmail()) return null;

  const [created] = await db
    .insert(users)
    .values({
      id: identity.userId,
      email,
      displayName: identity.displayName,
      role: "admin",
    })
    .returning();

  return created;
}

export function canWrite(role: InventoryRole): boolean {
  return role === "admin" || role === "operator";
}
