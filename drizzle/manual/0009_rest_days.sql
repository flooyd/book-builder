-- Rest days.
--
-- * writing_goal.rest_days: the weekdays a writer keeps for rest, as a bit mask (Monday is 1,
--   Tuesday 2, Wednesday 4, ... Sunday 64). A rest day never breaks a streak, and a book's
--   "words a day" leaves them out. Every writer starts with none.
--
-- Run once, after 0008. It is a single transaction and adds one column. Afterwards
-- `yarn db:push` reports no changes.

BEGIN;

ALTER TABLE "writing_goal" ADD COLUMN "rest_days" integer DEFAULT 0 NOT NULL;

COMMIT;
