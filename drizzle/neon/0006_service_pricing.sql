CREATE TABLE "service_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"option" text DEFAULT '' NOT NULL,
	"amount" text DEFAULT '' NOT NULL,
	"currency" text DEFAULT 'GHS' NOT NULL,
	"unit" text DEFAULT 'per project' NOT NULL,
	"mode" text DEFAULT 'fixed' NOT NULL,
	"minimum" integer DEFAULT 1 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "service_prices_service_idx" ON "service_prices" USING btree ("service");