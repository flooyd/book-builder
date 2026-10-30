-- Outlining tool.
--
-- * part.position / chapter.position: the order of parts in a book and of chapters in a part,
--   which the outline rearranges. Every book keeps today's order (oldest first).
-- * part.status / chapter.status: idea, outlined, drafting, revising or done. Chapters and
--   story-text parts that already have text start as drafting, the rest as idea.
-- * chapter_character / part_character: the characters who appear in a chapter, or in a part
--   that holds its own story text.
--
-- Run once, after 0003. It is a single transaction. Afterwards `yarn db:push` reports no
-- changes. Constraint names match drizzle-kit's.

BEGIN;

ALTER TABLE "part" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
ALTER TABLE "part" ADD COLUMN "status" text DEFAULT 'idea' NOT NULL;
ALTER TABLE "chapter" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
ALTER TABLE "chapter" ADD COLUMN "status" text DEFAULT 'idea' NOT NULL;

-- Today's order becomes the starting positions.
UPDATE "part" SET "position" = ordered.n
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "book_id" ORDER BY "created_at", "id") - 1 AS n
	FROM "part"
) AS ordered
WHERE "part"."id" = ordered."id";

UPDATE "chapter" SET "position" = ordered.n
FROM (
	SELECT "id", row_number() OVER (PARTITION BY "part_id" ORDER BY "created_at", "id") - 1 AS n
	FROM "chapter"
) AS ordered
WHERE "chapter"."id" = ordered."id";

-- Anything with story text written is being drafted.
UPDATE "chapter" SET "status" = 'drafting'
WHERE EXISTS (
	SELECT 1 FROM "story_text" s WHERE s."chapter_id" = "chapter"."id" AND btrim(s."content") <> ''
);
UPDATE "part" SET "status" = 'drafting'
WHERE "has_chapters" = 0 AND EXISTS (
	SELECT 1 FROM "story_text" s WHERE s."part_id" = "part"."id" AND btrim(s."content") <> ''
);

CREATE TABLE "chapter_character" (
	"chapter_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	CONSTRAINT "chapter_character_character_id_chapter_id_pk" PRIMARY KEY("character_id","chapter_id")
);
ALTER TABLE "chapter_character" ADD CONSTRAINT "chapter_character_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "chapter_character" ADD CONSTRAINT "chapter_character_character_id_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."character"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "chapter_character_chapter_id_idx" ON "chapter_character" USING btree ("chapter_id");

CREATE TABLE "part_character" (
	"part_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	CONSTRAINT "part_character_part_id_character_id_pk" PRIMARY KEY("part_id","character_id")
);
ALTER TABLE "part_character" ADD CONSTRAINT "part_character_part_id_part_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."part"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "part_character" ADD CONSTRAINT "part_character_character_id_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."character"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "part_character_character_id_idx" ON "part_character" USING btree ("character_id");

COMMIT;
