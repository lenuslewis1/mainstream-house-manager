CREATE TABLE `lead_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_at` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_lead_assets_lead_id` ON `lead_assets` (`lead_id`);