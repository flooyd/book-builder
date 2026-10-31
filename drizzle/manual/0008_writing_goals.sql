-- Writing goals.
--
-- * book.target_words / book.deadline: how long a book should be and when it should be done.
--   Both are optional; every book starts with neither.
-- * writing_goal: a writer's daily word target (0 means none), one row per writer, made the first
--   time they set one.
-- * writing_day: the words a writer wrote on each day (in their own time zone), which the daily
--   goal and the streak are worked out from. Nothing is backfilled: days start counting from the
--   first save after this runs.
--
-- Run once, after 0007. It is a single transaction. Afterwards `yarn db:push` reports no
-- changes. Constraint names match drizzle-kit's.

BEGIN;

ALTER TABLE "book" ADD COLUMN "target_words" integer;
ALTER TABLE "book" ADD COLUMN "deadline" date;

CREATE TABLE "writing_goal" (
	"user_id" text PRIMARY KEY NOT NULL,
	"daily_words" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "writing_goal" ADD CONSTRAINT "writing_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "writing_day" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"words" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "writing_day_user_id_day_pk" PRIMARY KEY("user_id","day")
);
ALTER TABLE "writing_day" ADD CONSTRAINT "writing_day_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

COMMIT;
