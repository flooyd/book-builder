import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { part } from '$lib/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const bookId = Number(event.params.bookId);

	if (!Number.isInteger(bookId)) {
		return json({ error: 'Invalid book id' }, { status: 400 });
	}

	const parts = await db
		.select()
		.from(part)
		.where(and(eq(part.bookId, bookId), eq(part.userId, user.id)))
		.orderBy(asc(part.createdAt));
	return json(parts);
};
