CREATE TABLE `finance_budgets` (
	`month` text NOT NULL,
	`currency` text NOT NULL,
	`revenue_target` text DEFAULT '0' NOT NULL,
	`expense_limit` text DEFAULT '0' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_finance_budgets_month_currency` ON `finance_budgets` (`month`,`currency`);--> statement-breakpoint
ALTER TABLE `work_items` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `payment_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `work_items` ADD `reference` text DEFAULT '' NOT NULL;