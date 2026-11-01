import { resolve } from '$app/paths';

// Series: books that belong together, in a reading order. Shared by the browser and the server.
// A series' story bible isn't stored: it's every entry linked to one of its books.

/** What ordering needs of a book. */
type Placed = {
	id: number;
	seriesId: number | null;
	seriesPosition: number;
	createdAt: string | Date;
};

/** A series' books in reading order: by position, then oldest first. */
export function booksInSeries<T extends Placed>(seriesId: number, books: T[]) {
	return books
		.filter((book) => book.seriesId === seriesId)
		.sort(
			(a, b) =>
				a.seriesPosition - b.seriesPosition ||
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
				a.id - b.id
		);
}

/** The other books in a book's series. */
export function seriesSiblings<T extends Placed>(bookId: number, books: T[]) {
	const seriesId = books.find((book) => book.id === bookId)?.seriesId;
	return seriesId ? books.filter((b) => b.seriesId === seriesId && b.id !== bookId) : [];
}

/** Where a book sits in its series; null when it isn't in one. */
export function placeInSeries<T extends Placed, S extends { id: number }>(
	book: T,
	books: T[],
	series: S[]
) {
	const found = series.find((item) => item.id === book.seriesId);
	if (!found) return null;
	const order = booksInSeries(found.id, books);
	const index = order.findIndex((item) => item.id === book.id);
	return {
		series: found,
		number: index + 1,
		total: order.length,
		previous: order[index - 1] ?? null,
		next: order[index + 1] ?? null
	};
}

/** These books as they stand once `bookIds` are the series, in that order. */
export function withSeriesBooks<T extends Placed>(books: T[], seriesId: number, bookIds: number[]) {
	return books.map((book) => {
		const position = bookIds.indexOf(book.id);
		if (position >= 0) return { ...book, seriesId, seriesPosition: position };
		return book.seriesId === seriesId ? { ...book, seriesId: null, seriesPosition: 0 } : book;
	});
}

/** What reading mode says about a book's series. */
export type ReaderSeries = {
	id: number;
	title: string;
	/** Its place in the reading order, counting every book, shared or not. */
	number: number;
	/** The next book this reader may open: a shared link only leads on to shared books. */
	next: { id: number; title: string; shareId: string | null } | null;
};

/** Where the next book opens for this reader. */
export const nextBookHref = (next: NonNullable<ReaderSeries['next']>, owner: boolean) =>
	owner || !next.shareId
		? resolve('/book/[id]/read', { id: String(next.id) })
		: resolve('/read/[shareId]', { shareId: next.shareId });

/** The series' page for this reader: the owner's own, or the one on the author's public page. */
export function seriesHref(id: number, owner: boolean, handle: string | null) {
	if (owner) return resolve('/series/[id]', { id: String(id) });
	return handle ? resolve('/author/[handle]/series/[id]', { handle, id: String(id) }) : null;
}
