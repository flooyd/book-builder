-- Phase 8: characters (owned by a user, linked to books) and systems.
--
-- Run once against a database created with `drizzle-kit push` before Phase 8. It is a single
-- transaction: if any statement fails, nothing changes. Afterwards `yarn db:push` reports no changes.
--
-- Why not `yarn db:push` directly? drizzle-kit can't tell whether character.user_id is new or a
-- rename of the dropped book_ids column, so it stops to ask; answering "rename" would break the
-- table. Constraint names below match what drizzle-kit generates for src/lib/server/db/schema.ts.
--
-- No API has ever written characters, so "character" should be empty. If it isn't, adding the
-- NOT NULL user_id column fails and the whole migration rolls back.

BEGIN;

-- character: belongs to a user; its books move to character_book.
ALTER TABLE "character" DROP COLUMN "book_ids";
ALTER TABLE "character" ADD COLUMN "user_id" text NOT NULL;
ALTER TABLE "character" ADD CONSTRAINT "character_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "character_book" (
	"character_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	CONSTRAINT "character_book_character_id_book_id_pk" PRIMARY KEY("character_id","book_id")
);
ALTER TABLE "character_book" ADD CONSTRAINT "character_book_character_id_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."character"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "character_book" ADD CONSTRAINT "character_book_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "character_book_book_id_idx" ON "character_book" USING btree ("book_id");

-- system: the rules a book's world runs on (magic, law, trade...).
CREATE TABLE "system" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT '' NOT NULL,
	"book_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "system" ADD CONSTRAINT "system_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "system" ADD CONSTRAINT "system_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

COMMIT;
