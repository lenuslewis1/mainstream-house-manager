ALTER TABLE `work_items` ADD `vendor_id` text;--> statement-breakpoint
CREATE INDEX `idx_work_items_vendor_id` ON `work_items` (`vendor_id`);