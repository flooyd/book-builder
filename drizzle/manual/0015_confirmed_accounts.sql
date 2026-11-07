-- Email confirmation: from now on a new account can't be used until its email is confirmed
-- (Better Auth's email_verified). The accounts made before that never had the chance, so they
-- count as confirmed and log in as they always have.
--
-- Data only: no table or column changes, so `yarn db:push` reports no changes before or after.
-- Run once, after 0014, and before the code that asks for confirmation is deployed, or those
-- accounts are asked to confirm at their next log-in. The cut-off is the day the rule arrived, so
-- accounts made while it was being tried out still have to confirm. Safe to run again: it only
-- touches accounts made before the cut-off.

BEGIN;

UPDATE "user"
SET "email_verified" = true
WHERE "email_verified" = false
	AND "created_at" < '2026-11-07';

COMMIT;
