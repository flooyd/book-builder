import { json, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { findOwnedArt } from '$lib/server/art';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { findOwnedBook } from '$lib/server/ownership';

// Put a picture from the writer's shelf on a book's cover, { artId }, or take it off with
// { artId: null } so the cover is drawn from the title again. Returns the updated book.
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid book id' }, { status: 400 });
	const found = await findOwnedBook(user.id, id);
	if (!found) return json({ error: 'Book not found' }, { status: 404 });

	const body = await event.request.json().catch(() => null);
	const artId = body?.artId ?? null;
	if (artId !== null && !(await findOwnedArt(user.id, Number(artId)))) {
		return json({ error: 'That picture isn’t on your shelf.' }, { status: 404 });
	}
	const [updated] = await db
		.update(book)
		// Like sharing, a cover isn't an edit to the writing: keep updatedAt as it was.
		.set({ coverArtId: artId === null ? null : Number(artId), updatedAt: found.updatedAt })
		.where(eq(book.id, id))
		.returning();
	return json(updated);
};
