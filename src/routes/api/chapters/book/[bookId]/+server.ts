import { db } from '$lib/server/db';
import { chapter, part } from '$lib/server/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const bookId = String(event.params.bookId);
	const partIds = await db
		.select()
		.from(part)
		.where(eq(part.bookId, parseInt(bookId)))
		.orderBy(asc(part.createdAt))
		.then((parts) => parts.map((p) => p.id));
	const chapters = await db
		.select()
		.from(chapter)
		.where(inArray(chapter.partId, partIds))
		.orderBy(asc(chapter.createdAt));
	return json(chapters);
};
