CREATE TABLE `task_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `work_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_updates_task` ON `task_updates` (`task_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_assignee` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_priority` text DEFAULT 'Normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_checklist` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_labels` text DEFAULT '' NOT NULL;