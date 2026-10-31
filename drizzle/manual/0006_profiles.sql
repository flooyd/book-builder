-- Author profiles: a private settings page, and a public page at /author/<handle> listing the
-- books an author shares. Nobody has a profile row yet; one is made the first time an author
-- saves their settings. Pages are private (is_public false) until the author turns them on.
--
-- Run once, after 0005. It is a single transaction. Afterwards `yarn db:push` reports no
-- changes. Constraint names match drizzle-kit's.

BEGIN;

CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text,
	"bio" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_handle_unique" UNIQUE("handle")
);
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

COMMIT;
