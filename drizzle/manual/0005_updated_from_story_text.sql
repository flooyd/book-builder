-- "Updated" dates follow the story text.
--
-- Saving story text now also marks its chapter (or story-text part), the part above and the
-- book as updated. Text saved before that change didn't, so this sets each of them to the latest
-- save of the text inside it. Dates only move forward. No schema change; safe to run again.

BEGIN;

-- A chapter or story-text part: when its own text was last saved.
UPDATE "chapter" SET "updated_at" = s."updated_at"
FROM "story_text" s
WHERE s."chapter_id" = "chapter"."id" AND s."updated_at" > "chapter"."updated_at";

UPDATE "part" SET "updated_at" = s."updated_at"
FROM "story_text" s
WHERE s."part_id" = "part"."id" AND s."updated_at" > "part"."updated_at";

-- A part that holds chapters: the latest save in any of them.
UPDATE "part" SET "updated_at" = latest.at
FROM (
	SELECT c."part_id", max(s."updated_at") AS at
	FROM "story_text" s JOIN "chapter" c ON c."id" = s."chapter_id"
	GROUP BY c."part_id"
) AS latest
WHERE latest."part_id" = "part"."id" AND latest.at > "part"."updated_at";

-- A book: the latest save anywhere in it.
UPDATE "book" SET "updated_at" = latest.at
FROM (
	SELECT p."book_id", max(s."updated_at") AS at
	FROM "story_text" s
	LEFT JOIN "chapter" c ON c."id" = s."chapter_id"
	JOIN "part" p ON p."id" = coalesce(s."part_id", c."part_id")
	GROUP BY p."book_id"
) AS latest
WHERE latest."book_id" = "book"."id" AND latest.at > "book"."updated_at";

COMMIT;
