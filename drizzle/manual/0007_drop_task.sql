-- Drop the "task" table, a leftover from the project template that nothing uses (the last open
-- item of the redesign handoff). Its id sequence goes with it.
--
-- Run after 0006. It is a single transaction. If the table holds any rows it stops and changes
-- nothing, so no data is lost by surprise. Safe to run again: with the table already gone it
-- does nothing. Afterwards `yarn db:push` reports no changes.

BEGIN;

DO $$
DECLARE
	has_rows boolean;
BEGIN
	IF to_regclass('public.task') IS NOT NULL THEN
		EXECUTE 'SELECT EXISTS (SELECT 1 FROM "task")' INTO has_rows;
		IF has_rows THEN
			RAISE EXCEPTION 'The task table has rows, so nothing was dropped. Look at them first.';
		END IF;
	END IF;
END $$;

DROP TABLE IF EXISTS "task";

COMMIT;
