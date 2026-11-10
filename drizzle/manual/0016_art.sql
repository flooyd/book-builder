-- The art shelf (idea 18): pictures a writer uploads or saves from the studio, and a book's cover.
--
-- * art: one picture. Its files are in storage (Vercel Blob, or a folder while developing), at
--   url and small_url; this table is the index, so the store is never listed. bytes is both files
--   together, which counts against the writer's room. It goes with its user.
-- * art_upload: an upload under way, holding the places in storage handed to the browser and the
--   bytes it said it would send, until the server has checked what arrived. It goes with its user.
-- * book.cover_art_id: the picture on a book's cover. Deleting the picture sets it back to null,
--   and the cover is drawn from the title again.
--
-- Run once, after 0015. It is a single transaction and only adds two tables and a nullable column,
-- so every book keeps its drawn cover. Afterwards `yarn db:push` reports no changes.

BEGIN;

CREATE TABLE "art" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"small_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"source" text DEFAULT 'upload' NOT NULL,
	"draft_key" text,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "art"
	ADD CONSTRAINT "art_user_id_user_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "art_user_id_idx" ON "art" USING btree ("user_id");

CREATE TABLE "art_upload" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"paths" jsonb NOT NULL,
	"bytes" integer NOT NULL,
	"replaces" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "art_upload"
	ADD CONSTRAINT "art_upload_user_id_user_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "art_upload_user_id_idx" ON "art_upload" USING btree ("user_id");

ALTER TABLE "book" ADD COLUMN "cover_art_id" integer;

ALTER TABLE "book"
	ADD CONSTRAINT "book_cover_art_id_art_id_fk"
	FOREIGN KEY ("cover_art_id") REFERENCES "public"."art"("id") ON DELETE set null ON UPDATE no action;

COMMIT;
