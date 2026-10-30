import { db } from '$lib/server/db';
import { part, book, chapter } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { textField } from '$lib/server/ownership';
import { eq, asc, inArray, sql } from 'drizzle-orm';
import { isStatus } from '$lib/status';
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
	const body = await event.request.json().catch(() => null);
	const title = textField(body?.title);
	const description = textField(body?.description);
	const parsedPartId = Number(body?.partId);

	if (!title) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	if (!Number.isInteger(parsedPartId)) {
		return json({ error: 'Invalid part id' }, { status: 400 });
	}

	const target = await db
		.select()
		.from(part)
		.where(eq(part.id, parsedPartId))
		.then((parts) => parts[0]);
	if (!target || target.userId !== user.id) {
		return json({ error: 'Part does not belong to the user' }, { status: 403 });
	}
	if (!target.hasChapters) {
		return json({ error: 'This part holds story text, not chapters' }, { status: 400 });
	}

	const newChapter = await db
		.insert(chapter)
		.values({
			title,
			description,
			showDescription: body?.showDescription === true,
			status: isStatus(body?.status) ? body.status : 'idea',
			partId: parsedPartId,
			// After the part's last chapter.
			position: sql`(select coalesce(max(${chapter.position}), -1) + 1 from ${chapter} where ${chapter.partId} = ${parsedPartId})`
		})
		.returning();

	return json(newChapter);
};
