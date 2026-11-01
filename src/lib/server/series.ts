import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book, profile, series, user } from '$lib/server/db/schema';
import { booksInSeries, type ReaderSeries } from '$lib/series';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The series, if it exists and belongs to the user. */
export async function findOwnedSeries(userId: string, seriesId: number) {
	const [row] = await db
		.select()
		.from(series)
		.where(and(eq(series.id, seriesId), eq(series.userId, userId)))
		.limit(1);
	return row;
}

/** True when every id is a different book of the user's. */
export async function ownsBooks(userId: string, bookIds: number[]) {
	if (bookIds.length === 0) return true;
	if (new Set(bookIds).size !== bookIds.length) return false;
	const rows = await db
		.select({ id: book.id })
		.from(book)
		.where(and(inArray(book.id, bookIds), eq(book.userId, userId)));
	return rows.length === bookIds.length;
}

/**
 * Make these books the series, in this order: books left off the list leave it, and a book from
 * another series moves here. updatedAt is left alone, as moving a book isn't editing it.
 */
export async function setSeriesBooks(tx: Tx, seriesId: number, bookIds: number[]) {
	await tx.execute(
		sql`update ${book} set "series_id" = null, "series_position" = 0 where ${book.seriesId} = ${seriesId}`
	);
	if (bookIds.length === 0) return;
	const values = sql.join(
		bookIds.map((id, position) => sql`(${id}::int, ${position}::int)`),
		sql`, `
	);
	await tx.execute(
		sql`update ${book} set "series_id" = ${seriesId}, "series_position" = v.position from (values ${values}) as v(id, position) where ${book.id} = v.id`
	);
}

/** The place after the last book in a series. */
export async function nextSeriesPosition(seriesId: number) {
	const [row] = await db
		.select({ last: sql<number>`coalesce(max(${book.seriesPosition}), -1)` })
		.from(book)
		.where(eq(book.seriesId, seriesId));
	return Number(row.last) + 1;
}

/** A series' books in reading order, with what's needed to find a place among them. */
async function orderedBooks(seriesId: number) {
	const books = await db
		.select({
			id: book.id,
			title: book.title,
			description: book.description,
			shareId: book.shareId,
			seriesId: book.seriesId,
			seriesPosition: book.seriesPosition,
			createdAt: book.createdAt
		})
		.from(book)
		.where(eq(book.seriesId, seriesId));
	return booksInSeries(seriesId, books);
}

/**
 * What reading mode says about a book's series. `owner` decides how far it may lead: someone on a
 * shared link only hears of books that are shared too, so a private book's title stays private.
 */
export async function readerSeries(
	found: typeof book.$inferSelect,
	owner: boolean
): Promise<ReaderSeries | null> {
	if (found.seriesId === null) return null;
	const [row] = await db
		.select({ id: series.id, title: series.title })
		.from(series)
		.where(eq(series.id, found.seriesId))
		.limit(1);
	if (!row) return null;

	const books = await orderedBooks(row.id);
	const index = books.findIndex((item) => item.id === found.id);
	const after = books.slice(index + 1);
	const next = owner ? after[0] : after.find((item) => item.shareId);
	return {
		...row,
		number: index + 1,
		next: next ? { id: next.id, title: next.title, shareId: next.shareId } : null
	};
}

/**
 * A series' public page: its title, description and the books shared by link, in reading order.
 * Null unless the author's page is on, the series is theirs and at least one book is shared. Each
 * book keeps its real number, so a private book leaves a gap and nothing else.
 */
export async function publicSeries(handle: string, id: number) {
	const [author] = await db
		.select({ userId: profile.userId, name: user.name })
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.where(and(eq(profile.handle, handle), eq(profile.isPublic, true)))
		.limit(1);
	if (!author) return null;

	const [row] = await db
		.select({ title: series.title, description: series.description })
		.from(series)
		.where(and(eq(series.id, id), eq(series.userId, author.userId)))
		.limit(1);
	if (!row) return null;

	const books = (await orderedBooks(id)).flatMap((item, index) =>
		item.shareId
			? [
					{
						id: item.id,
						title: item.title,
						description: item.description,
						shareId: item.shareId,
						number: index + 1
					}
				]
			: []
	);
	return books.length > 0 ? { ...row, author: author.name, books } : null;
}

/** Every series of a user's, oldest first. */
export const seriesOf = (userId: string) =>
	db.select().from(series).where(eq(series.userId, userId)).orderBy(asc(series.createdAt));
