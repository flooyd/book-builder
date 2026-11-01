-- Headings: how parts and chapters open in reading mode.
--
-- * book.part_labels, book.chapter_labels: the style of the automatic labels, one of words
--   ("Part One"), roman ("Part I"), numeral ("Part 1"), bare ("1") or none. They default to what
--   reading mode has always shown.
-- * book.chapter_titles: whether reading mode shows chapter titles at all.
-- * part.heading_label, chapter.heading_label: a label of its own. Null follows the book, an
--   empty string hides the label, anything else is the label. Only null takes a number.
-- * part.show_title, chapter.show_title: whether reading mode shows this title.
--
-- Run once, after 0011. It is a single transaction and only adds columns, so nothing changes for
-- existing books. Afterwards `yarn db:push` reports no changes.

BEGIN;

ALTER TABLE "book" ADD COLUMN "part_labels" text DEFAULT 'words' NOT NULL;
ALTER TABLE "book" ADD COLUMN "chapter_labels" text DEFAULT 'numeral' NOT NULL;
ALTER TABLE "book" ADD COLUMN "chapter_titles" boolean DEFAULT true NOT NULL;

ALTER TABLE "part" ADD COLUMN "heading_label" text;
ALTER TABLE "part" ADD COLUMN "show_title" boolean DEFAULT true NOT NULL;

ALTER TABLE "chapter" ADD COLUMN "heading_label" text;
ALTER TABLE "chapter" ADD COLUMN "show_title" boolean DEFAULT true NOT NULL;

COMMIT;
