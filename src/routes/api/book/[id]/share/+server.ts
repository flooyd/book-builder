import { randomBytes } from 'node:crypto';
import { json, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { findOwnedBook } from '$lib/server/ownership';

async function ownedBook(event: RequestEvent) {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) {
		return { error: json({ error: 'Invalid book id' }, { status: 400 }) };
	}
	const found = await findOwnedBook(user.id, id);
	if (!found) return { error: json({ error: 'Book not found' }, { status: 404 }) };
	return { found };
}

// Share the book: anyone with its /read/<shareId> link can read it, signed in or not. The id is
// random (16 url-safe characters), so the link can't be guessed. Returns the updated book.
export const POST = async (event: RequestEvent) => {
	const owned = await ownedBook(event);
	if ('error' in owned) return owned.error;
	if (owned.found.shareId) return json(owned.found);

	const [updated] = await db
		.update(book)
		// Sharing isn't an edit: keep updatedAt as it was.
		.set({ shareId: randomBytes(12).toString('base64url'), updatedAt: owned.found.updatedAt })
		.where(eq(book.id, owned.found.id))
		.returning();
	return json(updated);
};

// Stop sharing: the link stops working. Sharing again makes a new link.
export const DELETE = async (event: RequestEvent) => {
	const owned = await ownedBook(event);
	if ('error' in owned) return owned.error;

	const [updated] = await db
		.update(book)
		.set({ shareId: null, updatedAt: owned.found.updatedAt })
		.where(eq(book.id, owned.found.id))
		.returning();
	return json(updated);
};
