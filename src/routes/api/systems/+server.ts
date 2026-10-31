import { db } from '$lib/server/db';
import { system, systemBook } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { descriptionField, ownedBookIds, textField } from '$lib/server/ownership';
import { asc, eq, inArray } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

// The user's systems, each with the ids of the books it applies to.
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const systems = await db
		.select()
		.from(system)
		.where(eq(system.userId, user.id))
		.orderBy(asc(system.createdAt));
	const links = await db
		.select()
		.from(systemBook)
		.where(
			inArray(
				systemBook.systemId,
				systems.map((s) => s.id)
			)
		);
	return json(
		systems.map((s) => ({
			...s,
			bookIds: links.filter((link) => link.systemId === s.id).map((link) => link.bookId)
		}))
	);
};

export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const name = textField(body?.name);
	const description = descriptionField(body?.description);
	const kind = textField(body?.kind);

	if (!name) {
		return json({ error: 'Name is required' }, { status: 400 });
	}

	const books = await ownedBookIds(user.id, body?.bookIds);
	if ('error' in books) return books.error;
	const { bookIds } = books;

	const created = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(system)
			.values({ name, description, kind, userId: user.id })
			.returning();
		await tx.insert(systemBook).values(bookIds.map((bookId) => ({ systemId: row.id, bookId })));
		return row;
	});

	return json({ ...created, bookIds });
};
