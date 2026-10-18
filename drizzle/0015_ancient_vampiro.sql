CREATE TABLE `task_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`custom_name` text DEFAULT '' NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_assignee_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_reference_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `task_reference_date` text DEFAULT '' NOT NULL;