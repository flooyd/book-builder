-- Systems can belong to several books: replace system.book_id with a system_book link table.
--
-- Run once, after 0001. It is a single transaction: if any statement fails, nothing changes.
-- Every existing system keeps its current book (copied into system_book before the column is
-- dropped), and the check below aborts the migration if any link would be lost.
-- Afterwards `yarn db:push` reports no changes. Constraint names match drizzle-kit's.

BEGIN;

CREATE TABLE "system_book" (
	"system_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	CONSTRAINT "system_book_system_id_book_id_pk" PRIMARY KEY("system_id","book_id")
);
ALTER TABLE "system_book" ADD CONSTRAINT "system_book_system_id_system_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."system"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "system_book" ADD CONSTRAINT "system_book_book_id_book_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "system_book_book_id_idx" ON "system_book" USING btree ("book_id");

-- Keep each system's current book.
INSERT INTO "system_book" ("system_id", "book_id") SELECT "id", "book_id" FROM "system";

DO $$
BEGIN
	IF (SELECT count(*) FROM "system_book") <> (SELECT count(*) FROM "system") THEN
		RAISE EXCEPTION 'system_book does not cover every system; rolling back';
	END IF;
END $$;

-- Dropping the column also drops its foreign key (system_book_id_book_id_fk).
ALTER TABLE "system" DROP COLUMN "book_id";

COMMIT;
