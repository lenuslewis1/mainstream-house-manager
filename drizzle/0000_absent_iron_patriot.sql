CREATE TABLE `work_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`client` text DEFAULT '' NOT NULL,
	`service` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`amount` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT '' NOT NULL,
	`direction` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
