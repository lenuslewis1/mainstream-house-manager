ALTER TABLE "work_items" ADD COLUMN "created_by_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_items" ADD COLUMN "created_by_name" text DEFAULT '' NOT NULL;