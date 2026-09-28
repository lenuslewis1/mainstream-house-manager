CREATE TABLE `marketing_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`service` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`channel` text NOT NULL,
	`format` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`brief` text DEFAULT '' NOT NULL,
	`campaign` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_marketing_posts_date` ON `marketing_posts` (`date`);