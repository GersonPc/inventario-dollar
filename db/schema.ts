import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["admin", "operator", "viewer"] })
      .notNull()
      .default("viewer"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_users_email_unique").on(table.email),
    index("idx_users_role").on(table.role),
  ],
);

export const stores = sqliteTable(
  "stores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    storeNumber: text("store_number").notNull(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_stores_number_unique").on(table.storeNumber),
    index("idx_stores_name").on(table.name),
  ],
);

export const equipment = sqliteTable(
  "equipment",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    barcode: text("barcode").notNull(),
    model: text("model").notNull(),
    deviceType: text("device_type").notNull(),
    itemKind: text("item_kind", { enum: ["equipment", "material"] })
      .notNull()
      .default("equipment"),
    quantity: integer("quantity").notNull().default(1),
    receivedAt: text("received_at").notNull(),
    delivered: integer("delivered", { mode: "boolean" })
      .notNull()
      .default(false),
    condition: text("condition", {
      enum: ["working", "not_working", "unknown"],
    })
      .notNull()
      .default("unknown"),
    storeId: integer("store_id").references(() => stores.id, {
      onDelete: "set null",
    }),
    storeReference: text("store_reference"),
    deliveredAt: text("delivered_at"),
    macAddress: text("mac_address"),
    ipAddress: text("ip_address"),
    credentialCiphertext: text("credential_ciphertext"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_equipment_barcode_unique").on(table.barcode),
    index("idx_equipment_type").on(table.deviceType),
    index("idx_equipment_item_kind").on(table.itemKind),
    index("idx_equipment_store").on(table.storeId),
    index("idx_equipment_delivery").on(table.delivered),
    index("idx_equipment_condition").on(table.condition),
  ],
);

export const equipmentMovements = sqliteTable(
  "equipment_movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    equipmentId: integer("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    action: text("action", {
      enum: ["received", "updated", "delivered", "returned", "imported"],
    }).notNull(),
    storeId: integer("store_id").references(() => stores.id, {
      onDelete: "set null",
    }),
    details: text("details"),
    actorId: text("actor_id").references(() => users.id),
    occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_movements_equipment_date").on(
      table.equipmentId,
      table.occurredAt,
    ),
    index("idx_movements_actor").on(table.actorId),
  ],
);
