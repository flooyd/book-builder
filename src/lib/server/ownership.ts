import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book, chapter, part } from '$lib/server/db/schema';

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
