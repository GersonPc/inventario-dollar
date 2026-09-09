CREATE TABLE `sharepoint_inventory_summary` (
	`normalized_type` text PRIMARY KEY NOT NULL,
	`device_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`warehouse` integer NOT NULL,
	`delivered` integer NOT NULL,
	`assigned_to_store` integer NOT NULL,
	`source_version` text NOT NULL,
	`synchronized_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sharepoint_sync_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`source_version` text NOT NULL,
	`row_count` integer NOT NULL,
	`summary_total` integer NOT NULL,
	`synchronized_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `sharepoint_inventory_summary`
  (`normalized_type`, `device_type`, `quantity`, `warehouse`, `delivered`, `assigned_to_store`, `source_version`)
VALUES
  ('discos portables', 'DISCOS PORTABLES', 82, 82, 0, 0, 'f4ef6bd3ce1725c89b2ee86b12d4cabd1bead7c7eb5594a064fc1f7680a25698'),
  ('petty cash', 'Petty Cash', 11, 11, 0, 0, 'f4ef6bd3ce1725c89b2ee86b12d4cabd1bead7c7eb5594a064fc1f7680a25698'),
  ('pin pad', 'PIN PAD', 52, 52, 0, 0, 'f4ef6bd3ce1725c89b2ee86b12d4cabd1bead7c7eb5594a064fc1f7680a25698'),
  ('ups', 'ups', 57, 57, 0, 0, 'f4ef6bd3ce1725c89b2ee86b12d4cabd1bead7c7eb5594a064fc1f7680a25698');
--> statement-breakpoint
INSERT INTO `sharepoint_sync_state`
  (`id`, `source_version`, `row_count`, `summary_total`)
VALUES
  (1, 'f4ef6bd3ce1725c89b2ee86b12d4cabd1bead7c7eb5594a064fc1f7680a25698', 207, 202);
