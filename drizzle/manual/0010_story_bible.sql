-- The story bible: places, richer entries, mentions and connections.
--
-- * place / place_book: places of a world, linked to books the way systems are.
-- * character, system: aliases (short names to mention them by), details (labelled facts) and
--   notes. Every existing row starts with none, so nothing changes until a writer adds them.
-- * story_mention: which entries each piece of story text mentions, and how often. It is an index
--   of the mention nodes in story_text.content, rebuilt on every save. Existing text has no
--   mentions, so it starts empty and nothing is backfilled.
-- * entry_link: connections between entries ("captain of", "born on").
--
-- story_mention and entry_link point at characters, places and systems with a type and an id, so
-- they have no foreign key to those tables: deleting an entry clears its rows in the app.
--
-- Run once, after 0009. It is a single transaction. Afterwards `yarn db:push` reports no
-- changes. Constraint names match drizzle-kit's.

BEGIN;

ALTER TABLE "character" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "character" ADD COLUMN "details" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "character" ADD COLUMN "notes" text DEFAULT '' NOT NULL;

ALTER TABLE "system" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "system" ADD COLUMN "details" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "system" ADD COLUMN "notes" text DEFAULT '' NOT NULL;

CREATE TABLE "place" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT '' NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "place" ADD CONSTRAINT "place_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE "place_book" (
	"place_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	CONSTRAINT "place_book_place_id_book_id_pk" PRIMARY KEY("place_id","book_id")
);
ALTER TABLE "place_book" ADD CONSTRAINT "place_book_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "place_book" ADD CONSTRAINT "place_book_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "place_book_book_id_idx" ON "place_book" USING btree ("book_id");

CREATE TABLE "story_mention" (
	"story_text_id" integer NOT NULL,
	"entry_type" text NOT NULL,
	"entry_id" integer NOT NULL,
	"uses" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "story_mention_story_text_id_entry_type_entry_id_pk" PRIMARY KEY("story_text_id","entry_type","entry_id")
);
ALTER TABLE "story_mention" ADD CONSTRAINT "story_mention_story_text_id_story_text_id_fk" FOREIGN KEY ("story_text_id") REFERENCES "public"."story_text"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "story_mention_entry_idx" ON "story_mention" USING btree ("entry_type","entry_id");

CREATE TABLE "entry_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_type" text NOT NULL,
	"from_id" integer NOT NULL,
	"to_type" text NOT NULL,
	"to_id" integer NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "entry_link" ADD CONSTRAINT "entry_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "entry_link_from_idx" ON "entry_link" USING btree ("from_type","from_id");
CREATE INDEX "entry_link_to_idx" ON "entry_link" USING btree ("to_type","to_id");

COMMIT;
