CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`bill_to_name` text DEFAULT '' NOT NULL,
	`bill_to_details` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'GHS' NOT NULL,
	`line_items` text NOT NULL,
	`payment_details` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invoices_order_id` ON `invoices` (`order_id`);