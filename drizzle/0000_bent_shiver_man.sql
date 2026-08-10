CREATE TABLE `equipment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`barcode` text NOT NULL,
	`model` text NOT NULL,
	`device_type` text NOT NULL,
	`received_at` text NOT NULL,
	`delivered` integer DEFAULT false NOT NULL,
	`condition` text DEFAULT 'unknown' NOT NULL,
	`store_id` integer,
	`delivered_at` text,
	`mac_address` text,
	`ip_address` text,
	`credential_ciphertext` text,
	`notes` text,
	`created_by` text,
	`updated_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_equipment_barcode_unique` ON `equipment` (`barcode`);--> statement-breakpoint
CREATE INDEX `idx_equipment_type` ON `equipment` (`device_type`);--> statement-breakpoint
CREATE INDEX `idx_equipment_store` ON `equipment` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_equipment_delivery` ON `equipment` (`delivered`);--> statement-breakpoint
CREATE INDEX `idx_equipment_condition` ON `equipment` (`condition`);--> statement-breakpoint
CREATE TABLE `equipment_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_id` integer NOT NULL,
	`action` text NOT NULL,
	`store_id` integer,
	`details` text,
	`actor_id` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_movements_equipment_date` ON `equipment_movements` (`equipment_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_movements_actor` ON `equipment_movements` (`actor_id`);--> statement-breakpoint
CREATE TABLE `stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_number` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_stores_number_unique` ON `stores` (`store_number`);--> statement-breakpoint
CREATE INDEX `idx_stores_name` ON `stores` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_users_role` ON `users` (`role`);