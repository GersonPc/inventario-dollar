CREATE TABLE `sharepoint_links` (
	`item` text PRIMARY KEY NOT NULL,
	`equipment_id` integer,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`equipment_id`) REFERENCES `equipment`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sharepoint_equipment_unique` ON `sharepoint_links` (`equipment_id`);--> statement-breakpoint
CREATE TABLE `sharepoint_previews` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL
);
