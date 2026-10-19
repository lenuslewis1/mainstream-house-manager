ALTER TABLE "team_members" ADD COLUMN "role" text DEFAULT 'Team member' NOT NULL;
--> statement-breakpoint
UPDATE "team_members" SET "role" = 'Manager' WHERE lower("email") = 'lenuslewis40@gmail.com';
