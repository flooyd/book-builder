import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { coversFor } from '$lib/server/art';
import { book, profile, user } from '$lib/server/db/schema';
import { seriesOf } from '$lib/server/series';
import { booksInSeries } from '$lib/series';

export type ProfileSettings = {
	handle: string | null;
	bio: string;
	website: string;
	isPublic: boolean;
};

/** An author's profile settings; defaults until they first save them. */
export async function profileOf(userId: string): Promise<ProfileSettings> {
	const [row] = await db.select().from(profile).where(eq(profile.userId, userId)).limit(1);
	return row
		? { handle: row.handle, bio: row.bio, website: row.website, isPublic: row.isPublic }
		: { handle: null, bio: '', website: '', isPublic: false };
}

/**
 * A public author page: name, bio, website and the books shared by link. Null unless the
 * author has turned the page on.
 */
export async function publicAuthor(handle: string) {
	const [row] = await db
		.select({ userId: profile.userId, bio: profile.bio, website: profile.website, name: user.name })
		.from(profile)
		.innerJoin(user, eq(user.id, profile.userId))
		.where(and(eq(profile.handle, handle), eq(profile.isPublic, true)))
		.limit(1);
	if (!row) return null;

	const shared = await db
		.select({
			id: book.id,
			title: book.title,
			description: book.description,
			shareId: book.shareId,
			seriesId: book.seriesId,
			seriesPosition: book.seriesPosition,
			coverArtId: book.coverArtId,
			createdAt: book.createdAt,
			updatedAt: book.updatedAt
		})
		.from(book)
		.where(and(eq(book.userId, row.userId), isNotNull(book.shareId)))
		.orderBy(desc(book.updatedAt));

	const covers = await coversFor(shared.map((b) => b.coverArtId));
	const card = (b: (typeof shared)[number]) => ({
		id: b.id,
		title: b.title,
		description: b.description,
		shareId: b.shareId!,
		cover: b.coverArtId === null ? null : (covers[b.coverArtId] ?? null)
	});

	// A series only shows once a book in it is shared, and only with the books that are.
	const collections = await seriesOf(row.userId);
	return {
		name: row.name,
		bio: row.bio,
		website: row.website,
		series: collections.flatMap((item) => {
			const books = booksInSeries(item.id, shared);
			if (books.length === 0) return [];
			return [
				{
					id: item.id,
					title: item.title,
					description: item.description,
					books: books.map(card)
				}
			];
		}),
		books: shared.filter((b) => b.seriesId === null).map(card)
	};
}

/** The author's public page address, if it is on (for "by …" links in reading mode). */
export async function publicHandleOf(userId: string) {
	const [row] = await db
		.select({ handle: profile.handle })
		.from(profile)
		.where(and(eq(profile.userId, userId), eq(profile.isPublic, true)))
		.limit(1);
	return row?.handle ?? null;
}
