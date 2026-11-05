-- Version history: earlier states of a chapter's or part's story text.
--
-- * story_version: one kept copy of a piece of story text. saved_at is when that text was saved,
--   created_at when the copy was kept, and label is the writer's name for it (a named version is
--   never thinned out). Deleting the story text, and so its chapter or part, takes its versions.
--
-- Run once, after 0013. It is a single transaction and only adds a table, so nothing changes for
-- existing text: versions start with the next save. Afterwards `yarn db:push` reports no changes.

BEGIN;

CREATE TABLE "story_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_text_id" integer NOT NULL,
	"content" text NOT NULL,
	"words" integer DEFAULT 0 NOT NULL,
	"label" text,
	"saved_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "story_version"
	ADD CONSTRAINT "story_version_story_text_id_story_text_id_fk"
	FOREIGN KEY ("story_text_id") REFERENCES "public"."story_text"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "story_version_story_text_idx" ON "story_version" USING btree ("story_text_id","saved_at");

COMMIT;
