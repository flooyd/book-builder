import { db } from '$lib/server/db';
import { character, characterBook } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { ownedBookIds, textField } from '$lib/server/ownership';
import { asc, eq, inArray } from 'drizzle-orm';
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

	if (!name) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const books = await ownedBookIds(user.id, body?.bookIds);
	if ('error' in books) return books.error;
	const { bookIds } = books;

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
