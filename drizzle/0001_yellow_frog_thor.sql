ALTER TABLE `equipment` ADD `item_kind` text DEFAULT 'equipment' NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `equipment` ADD `store_reference` text;--> statement-breakpoint
CREATE INDEX `idx_equipment_item_kind` ON `equipment` (`item_kind`);