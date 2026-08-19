CREATE TABLE `device_model_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`catalog_key` text NOT NULL,
	`device_type` text NOT NULL,
	`model` text NOT NULL,
	`manufacturer` text,
	`description` text,
	`specifications` text,
	`image_key` text,
	`image_content_type` text,
	`updated_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_device_model_profiles_catalog_key_unique` ON `device_model_profiles` (`catalog_key`);--> statement-breakpoint
CREATE INDEX `idx_device_model_profiles_type_model` ON `device_model_profiles` (`device_type`,`model`);