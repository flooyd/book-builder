import { json, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { findOwnedBook } from '$lib/server/ownership';
import { bookWordCounts } from '$lib/server/goals';
import { MAX_BOOK_WORDS, isDay } from '$lib/goals';

/**
 * Set a book's goal: `targetWords` (a whole number of words, or null for none) and `deadline`
 * (a day written 'YYYY-MM-DD', or null for none). Returns the updated book and its word count.
 * A goal isn't an edit to the book, so "updated" doesn't change.
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid book id' }, { status: 400 });
	const found = await findOwnedBook(user.id, id);
	if (!found) return json({ error: 'Book not found' }, { status: 404 });

	const body = await event.request.json().catch(() => null);
	const targetWords = body?.targetWords ?? null;
	const deadline = body?.deadline ?? null;

	if (
		targetWords !== null &&
		(!Number.isInteger(targetWords) || targetWords < 1 || targetWords > MAX_BOOK_WORDS)
	) {
		return json(
			{
				error: `A word target is a whole number from 1 to ${MAX_BOOK_WORDS.toLocaleString('en')}.`
			},
			{ status: 400 }
		);
	}
	if (deadline !== null && !isDay(deadline)) {
		return json({ error: 'A deadline is a day, such as 2027-03-31.' }, { status: 400 });
	}

	const [updated] = await db
		.update(book)
		.set({ targetWords, deadline, updatedAt: found.updatedAt })
		.where(eq(book.id, id))
		.returning();
	const counts = await bookWordCounts(user.id, [id]);
	return json({ book: updated, words: counts[id] ?? 0 });
};
