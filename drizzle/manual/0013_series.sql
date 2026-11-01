-- Series: books that belong together, with a reading order.
--
-- * series: a writer's series, with its own title and description.
-- * book.series_id: the series a book belongs to, if any. Deleting a series leaves its books, so
--   the link goes back to null rather than taking them with it.
-- * book.series_position: where the book comes in the series' reading order.
--
-- A series' story bible needs nothing new: it's every entry linked to one of its books.
--
-- Run once, after 0012. It is a single transaction and only adds things, so nothing changes for
-- existing books. Afterwards `yarn db:push` reports no changes.

BEGIN;

CREATE TABLE "series" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "series"
	ADD CONSTRAINT "series_user_id_user_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "book" ADD COLUMN "series_id" integer;
ALTER TABLE "book" ADD COLUMN "series_position" integer DEFAULT 0 NOT NULL;

ALTER TABLE "book"
	ADD CONSTRAINT "book_series_id_series_id_fk"
	FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "book_series_id_idx" ON "book" USING btree ("series_id");

COMMIT;
