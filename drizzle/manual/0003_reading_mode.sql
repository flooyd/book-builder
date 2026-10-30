-- Reading mode.
--
-- * Parts and chapters can show their description as a subtitle under the title. Off for every
--   existing part and chapter, so descriptions written as notes stay private until the writer
--   turns them on.
-- * A book can be shared: share_id is the random id in its public /read/<share_id> link, or
--   NULL while the book is private (every existing book).
--
-- Run once, after 0002. It is a single transaction. Afterwards `yarn db:push` reports no
-- changes. Constraint names match drizzle-kit's.

BEGIN;

ALTER TABLE "part" ADD COLUMN "show_description" boolean DEFAULT false NOT NULL;
ALTER TABLE "chapter" ADD COLUMN "show_description" boolean DEFAULT false NOT NULL;

ALTER TABLE "book" ADD COLUMN "share_id" text;
ALTER TABLE "book" ADD CONSTRAINT "book_share_id_unique" UNIQUE("share_id");

COMMIT;
