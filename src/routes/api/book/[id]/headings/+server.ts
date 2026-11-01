import { json, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { findOwnedBook } from '$lib/server/ownership';
import { isLabelStyle, type LabelStyle } from '$lib/headings';

/**
 * Set how a book's headings read: any of `partLabels` and `chapterLabels` (a label style) and
 * `chapterTitles`. Returns the updated book. Like a goal, this isn't an edit to the book, so
 * "updated" doesn't change.
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid book id' }, { status: 400 });
	const found = await findOwnedBook(user.id, id);
	if (!found) return json({ error: 'Book not found' }, { status: 404 });

	const body = await event.request.json().catch(() => null);
	const changes: { partLabels?: LabelStyle; chapterLabels?: LabelStyle; chapterTitles?: boolean } =
		{};
	for (const field of ['partLabels', 'chapterLabels'] as const) {
		if (body?.[field] === undefined) continue;
		if (!isLabelStyle(body[field])) {
			return json({ error: 'Unknown label style' }, { status: 400 });
		}
		changes[field] = body[field];
	}
	if (typeof body?.chapterTitles === 'boolean') changes.chapterTitles = body.chapterTitles;
	if (Object.keys(changes).length === 0) {
		return json({ error: 'Nothing to change' }, { status: 400 });
	}

	const [updated] = await db
		.update(book)
		.set({ ...changes, updatedAt: found.updatedAt })
		.where(eq(book.id, id))
		.returning();
	return json(updated);
};
