import { db } from '$lib/server/db';
import { part } from '$lib/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const bookId = String(event.params.bookId);
	const parts = await db
		.select()
		.from(part)
		.where(eq(part.bookId, parseInt(bookId)))
		.orderBy(asc(part.createdAt));
	return json(parts);
};
