import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';

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

	await db.delete(book).where(and(eq(book.id, id), eq(book.userId, user.id)));

	return json({ message: 'Book deleted successfully' });
};
