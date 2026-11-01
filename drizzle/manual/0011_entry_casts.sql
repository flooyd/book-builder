-- A cast for places and systems, beside the cast of characters.
--
-- * chapter_place, part_place, chapter_system, part_system: which places and systems a chapter or
--   a story-text part holds, the same shape as chapter_character and part_character.
-- * Places and systems already mentioned in story text join those casts, as a first mention does
--   from now on, so the outline can filter by them straight away. Only those rows are written:
--   nothing existing changes, and mentions of characters already joined their cast.
--
-- Run once, after 0010. It is a single transaction. Afterwards `yarn db:push` reports no changes.
-- Constraint names match drizzle-kit's.

BEGIN;

CREATE TABLE "chapter_place" (
	"chapter_id" integer NOT NULL,
	"place_id" integer NOT NULL,
	CONSTRAINT "chapter_place_place_id_chapter_id_pk" PRIMARY KEY("place_id","chapter_id")
);
ALTER TABLE "chapter_place" ADD CONSTRAINT "chapter_place_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chapter_place" ADD CONSTRAINT "chapter_place_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "chapter_place_chapter_id_idx" ON "chapter_place" USING btree ("chapter_id");

CREATE TABLE "part_place" (
	"part_id" integer NOT NULL,
	"place_id" integer NOT NULL,
	CONSTRAINT "part_place_place_id_part_id_pk" PRIMARY KEY("place_id","part_id")
);
ALTER TABLE "part_place" ADD CONSTRAINT "part_place_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "part_place" ADD CONSTRAINT "part_place_place_id_place_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."place"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "part_place_part_id_idx" ON "part_place" USING btree ("part_id");

CREATE TABLE "chapter_system" (
	"chapter_id" integer NOT NULL,
	"system_id" integer NOT NULL,
	CONSTRAINT "chapter_system_system_id_chapter_id_pk" PRIMARY KEY("system_id","chapter_id")
);
ALTER TABLE "chapter_system" ADD CONSTRAINT "chapter_system_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chapter_system" ADD CONSTRAINT "chapter_system_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "chapter_system_chapter_id_idx" ON "chapter_system" USING btree ("chapter_id");

CREATE TABLE "part_system" (
	"part_id" integer NOT NULL,
	"system_id" integer NOT NULL,
	CONSTRAINT "part_system_system_id_part_id_pk" PRIMARY KEY("system_id","part_id")
);
ALTER TABLE "part_system" ADD CONSTRAINT "part_system_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "part_system" ADD CONSTRAINT "part_system_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "part_system_part_id_idx" ON "part_system" USING btree ("part_id");

INSERT INTO "chapter_place" ("chapter_id", "place_id")
SELECT DISTINCT text."chapter_id", mention."entry_id"
FROM "story_mention" AS mention
JOIN "story_text" AS text ON text."id" = mention."story_text_id"
JOIN "place" ON "place"."id" = mention."entry_id"
WHERE mention."entry_type" = 'place' AND text."chapter_id" IS NOT NULL;

INSERT INTO "part_place" ("part_id", "place_id")
SELECT DISTINCT text."part_id", mention."entry_id"
FROM "story_mention" AS mention
JOIN "story_text" AS text ON text."id" = mention."story_text_id"
JOIN "place" ON "place"."id" = mention."entry_id"
WHERE mention."entry_type" = 'place' AND text."chapter_id" IS NULL AND text."part_id" IS NOT NULL;

INSERT INTO "chapter_system" ("chapter_id", "system_id")
SELECT DISTINCT text."chapter_id", mention."entry_id"
FROM "story_mention" AS mention
JOIN "story_text" AS text ON text."id" = mention."story_text_id"
JOIN "system" ON "system"."id" = mention."entry_id"
WHERE mention."entry_type" = 'system' AND text."chapter_id" IS NOT NULL;

INSERT INTO "part_system" ("part_id", "system_id")
SELECT DISTINCT text."part_id", mention."entry_id"
FROM "story_mention" AS mention
JOIN "story_text" AS text ON text."id" = mention."story_text_id"
JOIN "system" ON "system"."id" = mention."entry_id"
WHERE mention."entry_type" = 'system' AND text."chapter_id" IS NULL AND text."part_id" IS NOT NULL;

COMMIT;
