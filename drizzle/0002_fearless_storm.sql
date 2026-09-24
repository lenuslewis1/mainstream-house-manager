ALTER TABLE `work_items` ADD `source_lead_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_items_source_lead_id` ON `work_items` (`source_lead_id`);