import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { chapter, part } from '$lib/server/db/schema';
import { and, eq, asc, inArray } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const bookId = Number(event.params.bookId);

	if (!Number.isInteger(bookId)) {
		return json({ error: 'Invalid book id' }, { status: 400 });
	}

	const partIds = await db
		.select()
		.from(part)
		.where(and(eq(part.bookId, bookId), eq(part.userId, user.id)))
		.orderBy(asc(part.createdAt))
		.then((parts) => parts.map((p) => p.id));
	const chapters = await db
		.select()
		.from(chapter)
		.where(inArray(chapter.partId, partIds))
		.orderBy(asc(chapter.createdAt));
	return json(chapters);
};
