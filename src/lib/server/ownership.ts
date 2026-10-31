import { json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book, chapter, part } from '$lib/server/db/schema';
import { cleanValue } from '$lib/rich';

/** The book, if it exists and belongs to the user. */
export async function findOwnedBook(userId: string, bookId: number) {
	const [row] = await db
		.select()
		.from(book)
		.where(and(eq(book.id, bookId), eq(book.userId, userId)))
		.limit(1);
	return row;
}

/** The part, if it exists and belongs to the user. */
export async function findOwnedPart(userId: string, partId: number) {
	const [row] = await db
		.select()
		.from(part)
		.where(and(eq(part.id, partId), eq(part.userId, userId)))
		.limit(1);
	return row;
}

/** The chapter, if it exists and its part belongs to the user. */
export async function findOwnedChapter(userId: string, chapterId: number) {
	const [row] = await db
		.select({ chapter })
		.from(chapter)
		.innerJoin(part, eq(chapter.partId, part.id))
		.where(and(eq(chapter.id, chapterId), eq(part.userId, userId)))
		.limit(1);
	return row?.chapter;
}

/** A trimmed string field from a JSON body; '' when missing or not a string. */
export const textField = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/**
 * A description from a JSON body: plain text, or formatted text cleaned against the editor's
 * allow-list (see $lib/rich).
 */
export const descriptionField = (value: unknown) => cleanValue(textField(value), 'description');

/**
 * The `bookIds` of a character or system: at least one, all owned by the user. Returns the
 * de-duplicated ids, or an error response to send back.
 */
export async function ownedBookIds(
	userId: string,
	value: unknown
): Promise<{ bookIds: number[] } | { error: Response }> {
	const bookIds = Array.isArray(value) ? [...new Set<number>(value.map(Number))] : [];

	if (bookIds.length === 0 || !bookIds.every((id) => Number.isInteger(id))) {
		return { error: json({ error: 'Choose at least one book' }, { status: 400 }) };
	}

	const owned = await db
		.select({ id: book.id })
		.from(book)
		.where(and(inArray(book.id, bookIds), eq(book.userId, userId)));
	if (owned.length !== bookIds.length) {
		return { error: json({ error: 'Book does not belong to the user' }, { status: 403 }) };
	}

	return { bookIds };
}
