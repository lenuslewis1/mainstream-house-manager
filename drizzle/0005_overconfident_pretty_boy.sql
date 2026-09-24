ALTER TABLE `work_items` ADD `price` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `cost` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `project_id` text;--> statement-breakpoint
CREATE INDEX `idx_work_items_project_id` ON `work_items` (`project_id`);