import { users } from "@/db/schema";

export type InventoryRole = "admin" | "operator" | "viewer";
type InventoryUser = typeof users.$inferSelect;

const publicInventoryUser: InventoryUser = {
  id: "public-reader",
  email: "public-reader@inventory.local",
  displayName: "Consulta pública",
  // Write operations are protected separately by the shared write-access token.
  role: "operator",
  active: true,
  createdAt: "",
  updatedAt: "",
};

/**
 * Reading the inventory is intentionally anonymous. No Cloudflare identity,
 * account or user row is consulted in the request path.
 */
export async function getInventoryUser(): Promise<InventoryUser> {
  return publicInventoryUser;
}

export function canWrite(role: InventoryRole): boolean {
  return role === "admin" || role === "operator";
}
