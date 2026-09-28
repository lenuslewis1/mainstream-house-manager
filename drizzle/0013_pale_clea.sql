CREATE TABLE `task_generations` (
	`source_key` text PRIMARY KEY NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`source_title` text NOT NULL,
	`status` text NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`run_id` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_source_kind` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_source_id` text;--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_work_items_task_key` ON `work_items` (`task_key`);