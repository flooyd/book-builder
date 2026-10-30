import { db } from '$lib/server/db';
import { book, character, characterBook } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { textField } from '$lib/server/ownership';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

// The user's characters, each with the ids of the books they appear in.
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const characters = await db
		.select()
		.from(character)
		.where(eq(character.userId, user.id))
		.orderBy(asc(character.createdAt));
	const links = await db
		.select()
		.from(characterBook)
		.where(
			inArray(
				characterBook.characterId,
				characters.map((c) => c.id)
			)
		);
	return json(
		characters.map((c) => ({
			...c,
			bookIds: links.filter((link) => link.characterId === c.id).map((link) => link.bookId)
		}))
	);
};

export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const name = textField(body?.name);
	const description = textField(body?.description);
	const bookIds: number[] = Array.isArray(body?.bookIds)
		? [...new Set<number>(body.bookIds.map(Number))]
		: [];

	if (!name) {
		return json({ error: 'Name is required' }, { status: 400 });
	}
	if (bookIds.length === 0 || !bookIds.every((id) => Number.isInteger(id))) {
		return json({ error: 'Choose at least one book' }, { status: 400 });
	}

	const owned = await db
		.select({ id: book.id })
		.from(book)
		.where(and(inArray(book.id, bookIds), eq(book.userId, user.id)));
	if (owned.length !== bookIds.length) {
		return json({ error: 'Book does not belong to the user' }, { status: 403 });
	}

	const created = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(character)
			.values({ name, description, userId: user.id })
			.returning();
		await tx
			.insert(characterBook)
			.values(bookIds.map((bookId) => ({ characterId: row.id, bookId })));
		return row;
	});

	return json({ ...created, bookIds });
};
