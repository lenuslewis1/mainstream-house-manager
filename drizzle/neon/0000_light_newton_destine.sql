CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"contact_person" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"specialty" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_budgets" (
	"month" text NOT NULL,
	"currency" text NOT NULL,
	"revenue_target" text DEFAULT '0' NOT NULL,
	"expense_limit" text DEFAULT '0' NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text NOT NULL,
	"bill_to_name" text DEFAULT '' NOT NULL,
	"bill_to_details" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"line_items" text NOT NULL,
	"payment_details" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" bigint NOT NULL,
	"uploaded_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_posts" (
	"time" text DEFAULT '' NOT NULL,
	"pillar" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"hashtag" text DEFAULT '' NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"service" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"channel" text NOT NULL,
	"format" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"campaign" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" bigint NOT NULL,
	"uploaded_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_deliverables" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"due_date" text NOT NULL,
	"status" text DEFAULT 'Planned' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"object_key" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "stored_files_size" CHECK (octet_length("stored_files"."data") <= 26214400)
);
--> statement-breakpoint
CREATE TABLE "task_columns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_generations" (
	"source_key" text PRIMARY KEY NOT NULL,
	"source_kind" text NOT NULL,
	"source_id" text NOT NULL,
	"source_title" text NOT NULL,
	"status" text NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"run_id" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"custom_name" text DEFAULT '' NOT NULL,
	"last_seen" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"client" text DEFAULT '' NOT NULL,
	"service" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"amount" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT '' NOT NULL,
	"direction" text DEFAULT '' NOT NULL,
	"price" text DEFAULT '0' NOT NULL,
	"cost" text DEFAULT '0' NOT NULL,
	"cost_items" text DEFAULT '[]' NOT NULL,
	"project_id" text,
	"vendor_id" text,
	"source_lead_id" text,
	"task_source_kind" text DEFAULT '' NOT NULL,
	"task_source_id" text,
	"task_key" text,
	"task_assignee" text DEFAULT '' NOT NULL,
	"task_assignee_id" text DEFAULT '' NOT NULL,
	"task_reference_url" text DEFAULT '' NOT NULL,
	"task_reference_date" text DEFAULT '' NOT NULL,
	"task_priority" text DEFAULT 'Normal' NOT NULL,
	"task_checklist" text DEFAULT '[]' NOT NULL,
	"task_labels" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"payment_method" text DEFAULT '' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_assets" ADD CONSTRAINT "lead_assets_lead_id_work_items_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_id_work_items_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_project_id_work_items_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_updates" ADD CONSTRAINT "task_updates_task_id_work_items_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."work_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_contacts_kind" ON "contacts" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_finance_budgets_month_currency" ON "finance_budgets" USING btree ("month","currency");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_order_id" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_lead_assets_lead_id" ON "lead_assets" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_marketing_posts_date" ON "marketing_posts" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_project_assets_project_id" ON "project_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_project_deliverables_project_date" ON "project_deliverables" USING btree ("project_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_task_updates_task" ON "task_updates" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_work_items_source_lead_id" ON "work_items" USING btree ("source_lead_id");--> statement-breakpoint
CREATE INDEX "idx_work_items_project_id" ON "work_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_work_items_vendor_id" ON "work_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_work_items_task_key" ON "work_items" USING btree ("task_key");