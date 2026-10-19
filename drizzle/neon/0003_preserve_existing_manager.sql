-- Preserve full access for the pre-existing approved business owner account.
UPDATE "team_members" SET "role"='Manager' WHERE lower("email")='mainstreammediahouse7@gmail.com' AND "role"='Team member';
