import { json, type RequestEvent } from '@sveltejs/kit';
import { eq, inArray, sql } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { chapter, part } from '$lib/server/db/schema';
import { findOwnedBook } from '$lib/server/ownership';
import { isIdList, sameIds } from '$lib/server/outline';

/**
 * Rearrange a book: `parts` lists every part of the book in order, and `chapters` maps each part
 * that holds chapters to its chapters in order. Every chapter of the book must be listed once,
 * so chapters can move between parts but never leave the book. Only the rows that changed are
 * written; updatedAt is left alone (moving isn't editing).
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const bookId = Number(event.params.id);
	const found = Number.isInteger(bookId) ? await findOwnedBook(user.id, bookId) : undefined;
	if (!found) return json({ error: 'Book not found' }, { status: 404 });

	const body = await event.request.json().catch(() => null);
	const partOrder = body?.parts;
	const chapterOrder = body?.chapters;
	if (!isIdList(partOrder) || !chapterOrder || typeof chapterOrder !== 'object') {
		return json({ error: 'Expected { parts, chapters }' }, { status: 400 });
	}

	const parts = await db
		.select({ id: part.id, hasChapters: part.hasChapters, position: part.position })
		.from(part)
		.where(eq(part.bookId, bookId));
	const chapters = parts.length
		? await db
				.select({ id: chapter.id, partId: chapter.partId, position: chapter.position })
				.from(chapter)
				.where(
					inArray(
						chapter.partId,
						parts.map((p) => p.id)
					)
				)
		: [];

	if (
		!sameIds(
			partOrder,
			parts.map((p) => p.id)
		)
	) {
		return json({ error: 'List every part of the book once' }, { status: 400 });
	}

	const holders = new Set(parts.filter((p) => p.hasChapters).map((p) => p.id));
	const lists: [number, number[]][] = [];
	for (const [key, ids] of Object.entries(chapterOrder)) {
		const partId = Number(key);
		if (!holders.has(partId) || !isIdList(ids)) {
			return json({ error: 'Chapters can only go in parts that hold chapters' }, { status: 400 });
		}
		lists.push([partId, ids]);
	}
	if (
		!sameIds(
			lists.flatMap(([, ids]) => ids),
			chapters.map((c) => c.id)
		)
	) {
		return json({ error: 'List every chapter of the book once' }, { status: 400 });
	}

	const partBefore = new Map(parts.map((p) => [p.id, p.position]));
	const partRows = partOrder
		.map((id, position) => ({ id, position }))
		.filter((row) => partBefore.get(row.id) !== row.position);

	const chapterBefore = new Map(chapters.map((c) => [c.id, c]));
	const chapterRows = lists
		.flatMap(([partId, ids]) => ids.map((id, position) => ({ id, partId, position })))
		.filter((row) => {
			const before = chapterBefore.get(row.id)!;
			return before.partId !== row.partId || before.position !== row.position;
		});

	// One UPDATE … FROM (VALUES …) per table, so a big move is still one round trip each.
	await db.transaction(async (tx) => {
		if (partRows.length) {
			const values = sql.join(
				partRows.map((row) => sql`(${row.id}::int, ${row.position}::int)`),
				sql`, `
			);
			await tx.execute(
				sql`update ${part} set "position" = v.position from (values ${values}) as v(id, position) where ${part.id} = v.id`
			);
		}
		if (chapterRows.length) {
			const values = sql.join(
				chapterRows.map((row) => sql`(${row.id}::int, ${row.partId}::int, ${row.position}::int)`),
				sql`, `
			);
			await tx.execute(
				sql`update ${chapter} set "part_id" = v.part_id, "position" = v.position from (values ${values}) as v(id, part_id, position) where ${chapter.id} = v.id`
			);
		}
	});

	return json({ parts: partRows.length, chapters: chapterRows.length });
};
