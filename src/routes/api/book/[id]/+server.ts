import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { book, character, characterBook, system, systemBook } from '$lib/server/db/schema';
import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq, exists, notExists, ne } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Correlated subquery: the item (`itemId`, e.g. character.id) is linked to `bookId` and to no
 * other book, according to `links` (character_book or system_book).
 */
function onlyInBook(
	tx: Tx,
	links: typeof characterBook | typeof systemBook,
	linkItemId: PgColumn,
	itemId: PgColumn,
	bookId: number
) {
	return tx
		.select()
		.from(links)
		.where(
			and(
				eq(linkItemId, itemId),
				eq(links.bookId, bookId),
				notExists(
					tx
						.select()
						.from(links)
						.where(and(eq(linkItemId, itemId), ne(links.bookId, bookId)))
				)
			)
		);
}

//get a single book by id
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const idParam = event.params.id;
	const id = Number(idParam);

	if (!Number.isInteger(id)) {
		return json({ error: 'Invalid book id' }, { status: 400 });
	}

	const bookData = await db
		.select()
		.from(book)
		.where(and(eq(book.id, id), eq(book.userId, user.id)));

	if (bookData.length === 0) {
		return json({ error: 'Book not found' }, { status: 404 });
	}

	return json(bookData[0]);
};

// update a book's title and/or description; returns the updated row
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);

	if (!Number.isInteger(id)) {
		return json({ error: 'Invalid book id' }, { status: 400 });
	}

	const body = await event.request.json().catch(() => null);
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	if (!title) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	const changes: { title: string; description?: string } = { title };
	if (typeof body?.description === 'string') changes.description = body.description.trim();

	const [updated] = await db
		.update(book)
		.set(changes)
		.where(and(eq(book.id, id), eq(book.userId, user.id)))
		.returning();

	if (!updated) {
		return json({ error: 'Book not found' }, { status: 404 });
	}

	return json(updated);
};

export const DELETE = async (event: RequestEvent) => {
	const user = requireUser(event);
	const idParam = event.params.id;
	const id = Number(idParam);

	if (!Number.isInteger(id)) {
		return json({ error: 'Invalid book id' }, { status: 400 });
	}

	const bookData = await db
		.select()
		.from(book)
		.where(and(eq(book.id, id), eq(book.userId, user.id)));

	if (bookData.length === 0) {
		return json({ error: 'Book not found' }, { status: 404 });
	}

	await db.transaction(async (tx) => {
		// Characters and systems that appear only in this book go with it; ones shared with other
		// books stay (their link to this book is removed by the cascade).
		await tx
			.delete(character)
			.where(
				and(
					eq(character.userId, user.id),
					exists(onlyInBook(tx, characterBook, characterBook.characterId, character.id, id))
				)
			);
		await tx
			.delete(system)
			.where(
				and(
					eq(system.userId, user.id),
					exists(onlyInBook(tx, systemBook, systemBook.systemId, system.id, id))
				)
			);
		await tx.delete(book).where(and(eq(book.id, id), eq(book.userId, user.id)));
	});

	return json({ message: 'Book deleted successfully' });
};
