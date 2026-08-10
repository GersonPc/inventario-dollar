import { eq, sql } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export type InventoryRole = "admin" | "operator" | "viewer";

export async function getInventoryUser() {
  const identity = await getChatGPTUser();
  if (!identity) return null;

  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, identity.userId))
    .limit(1);

  if (existing) {
    if (
      existing.email !== identity.email ||
      existing.displayName !== identity.displayName
    ) {
      await db
        .update(users)
        .set({
          email: identity.email,
          displayName: identity.displayName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, identity.userId));
    }
    return { ...existing, email: identity.email, displayName: identity.displayName };
  }

  const [summary] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  const role: InventoryRole = Number(summary?.count ?? 0) === 0 ? "admin" : "viewer";

  const [created] = await db
    .insert(users)
    .values({
      id: identity.userId,
      email: identity.email,
      displayName: identity.displayName,
      role,
    })
    .returning();

  return created;
}

export function canWrite(role: InventoryRole): boolean {
  return role === "admin" || role === "operator";
}
