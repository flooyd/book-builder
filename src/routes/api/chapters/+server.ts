import { db } from '$lib/server/db';
import { part, book, chapter } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
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
	const partIds = await db
		.select()
		.from(part)
		.where(inArray(part.bookId, bookIds))
		.orderBy(asc(part.createdAt))
		.then((parts) => parts.map((p) => p.id));
	const chapters = await db
		.select()
		.from(chapter)
		.where(inArray(chapter.partId, partIds))
		.orderBy(asc(chapter.createdAt));
	return json(chapters);
};

export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const { title, description, partId } = await event.request.json();
	const parsedPartId = Number(partId);

	if (!Number.isInteger(parsedPartId)) {
		return json({ error: 'Invalid part id' }, { status: 400 });
	}

	const partExists = await db
		.select()
		.from(part)
		.where(eq(part.id, parsedPartId))
		.then((parts) => parts.length > 0 && parts[0].userId === user.id);
	if (!partExists) {
		return json({ error: 'Part does not belong to the user' }, { status: 403 });
	}

    const newChapter = await db.insert(chapter).values({title, description, partId: parsedPartId}).returning();

    return json(newChapter);
};
