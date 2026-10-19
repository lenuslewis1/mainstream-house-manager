-- Reserve role assignment for the verified owner identity.
UPDATE "team_members" SET "role"='Manager' WHERE "role"='Super admin' AND lower("email") <> 'lenuslewis40@gmail.com';
--> statement-breakpoint
UPDATE "team_members" SET "role"='Super admin' WHERE lower("email")='lenuslewis40@gmail.com';
--> statement-breakpoint
INSERT INTO "team_members" (id,name,email,last_seen,role) SELECT id,COALESCE(NULLIF(name,''),email),email,0,'Super admin' FROM neon_auth."user" WHERE lower(email)='lenuslewis40@gmail.com' ON CONFLICT(id) DO UPDATE SET role='Super admin';
