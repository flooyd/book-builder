import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/auth-guard';
import { descriptionField, textField } from '$lib/server/ownership';
import { findOwnedSeries, nextSeriesPosition } from '$lib/server/series';
import { eq, asc } from 'drizzle-orm';
import { json, type RequestEvent } from '@sveltejs/kit';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const books = await db
		.select()
		.from(book)
		.where(eq(book.userId, user.id))
		.orderBy(asc(book.createdAt));
	return json(books);
};

export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const title = textField(body?.title);
	const description = descriptionField(body?.description);

	if (!title) {
		return json({ error: 'Title is required' }, { status: 400 });
	}

	// A book started from a series goes on the end of its reading order.
	const seriesId = body?.seriesId ?? null;
	if (seriesId !== null) {
		const found = Number.isInteger(seriesId) && (await findOwnedSeries(user.id, seriesId));
		if (!found) return json({ error: 'Series not found' }, { status: 404 });
	}
	const seriesPosition = seriesId === null ? 0 : await nextSeriesPosition(seriesId);

	const newBook = await db
		.insert(book)
		.values({ title, description, userId: user.id, seriesId, seriesPosition })
		.returning();
	return json(newBook);
};
