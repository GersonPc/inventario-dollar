import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export type InventoryRole = "admin" | "operator" | "viewer";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getBootstrapAdminEmail(): string {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  return normalizeEmail(runtimeEnv.INVENTORY_ADMIN_EMAIL ?? "");
}

export async function getInventoryUser() {
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
