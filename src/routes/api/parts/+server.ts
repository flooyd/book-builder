import { db } from '$lib/server/db';
import { part, book } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { textField } from '$lib/server/ownership';
import { eq, asc, inArray } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const bookIds = await db
		.select()
		.from(book)
		.where(eq(book.userId, user.id))
		.orderBy(asc(book.createdAt))
		.then((books) => books.map((b) => b.id));
	const parts = await db
		.select()
		.from(part)
		.where(inArray(part.bookId, bookIds))
		.orderBy(asc(part.createdAt));
	return json(parts);
};

export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const title = textField(body?.title);
	const description = textField(body?.description);
	const hasChapters = body?.hasChapters;
	const parsedBookId = Number(body?.bookId);

	if (!title) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	if (!Number.isInteger(parsedBookId)) {
		return json({ error: 'Invalid book id' }, { status: 400 });
	}

	const bookExists = await db
		.select()
		.from(book)
		.where(eq(book.id, parsedBookId))
		.then((books) => books.length > 0 && books[0].userId === user.id);
	if (!bookExists) {
		return json({ error: 'Book does not belong to the user' }, { status: 403 });
	}

	const newPart = await db
		.insert(part)
		.values({
			userId: user.id,
			title,
			description,
			hasChapters: Number(hasChapters) ? 1 : 0,
			showDescription: body?.showDescription === true,
			bookId: parsedBookId
		})
		.returning();

	return json(newPart);
};
