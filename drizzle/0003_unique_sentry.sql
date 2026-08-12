ALTER TABLE `equipment` ADD `is_network_device` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `equipment`
SET `is_network_device` = true
WHERE `item_kind` = 'equipment'
  AND (
    `mac_address` IS NOT NULL
    OR `ip_address` IS NOT NULL
    OR `credential_ciphertext` IS NOT NULL
  );
