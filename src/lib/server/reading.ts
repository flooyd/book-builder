import { eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { coverFor } from '$lib/server/art';
import { book, chapter, part, user } from '$lib/server/db/schema';
import { storyTexts } from '$lib/server/outline';
import { publicHandleOf } from '$lib/server/profile';
import { withoutMentions } from '$lib/rich';

const iso = (date: Date) => date.toISOString();

/**
 * Everything reading mode shows of a book, and nothing else: the titles and descriptions the
 * writer chose to show (hidden ones may be private notes, so they are blanked here, not in the
 * page), the story texts and the author's name. Shared by the owner's /book/[id]/read and the
 * public /read/[shareId], which anyone can open. Mentions become plain words here, because the
 * links themselves can give the story away: "the stranger" pointing at Juno's id is a spoiler for
 * anyone who reads the page source.
 */
export async function readableBook(found: typeof book.$inferSelect) {
	const parts = await db.select().from(part).where(eq(part.bookId, found.id));
	const partIds = parts.map((p) => p.id);
	const chapters = partIds.length
		? await db.select().from(chapter).where(inArray(chapter.partId, partIds))
		: [];
	const chapterIds = chapters.map((c) => c.id);

	const texts = Object.fromEntries(
		Object.entries(await storyTexts(partIds, chapterIds)).map(([key, value]) => [
			key,
			withoutMentions(value)
		])
	);

	const [author] = await db
		.select({ name: user.name })
		.from(user)
		.where(eq(user.id, found.userId))
		.limit(1);
	const cover = await coverFor(found.coverArtId);

	return {
		book: {
			id: found.id,
			title: found.title,
			description: found.description,
			partLabels: found.partLabels,
			chapterLabels: found.chapterLabels,
			/** The writer's picture for the cover, if there is one. */
			cover
		},
		// ISO timestamps, as in the client stores, so bookOutline orders them the same way.
		parts: parts.map((p) => ({
			id: p.id,
			bookId: p.bookId,
			title: p.showTitle ? p.title : '',
			description: p.showDescription ? p.description : '',
			headingLabel: p.headingLabel,
			hasChapters: p.hasChapters,
			position: p.position,
			createdAt: iso(p.createdAt)
		})),
		chapters: chapters.map((c) => ({
			id: c.id,
			partId: c.partId,
			title: c.showTitle && found.chapterTitles ? c.title : '',
			description: c.showDescription ? c.description : '',
			headingLabel: c.headingLabel,
			position: c.position,
			createdAt: iso(c.createdAt)
		})),
		texts,
		author: author?.name ?? '',
		/** The author's public page, if it is on. */
		authorHandle: await publicHandleOf(found.userId)
	};
}

export type ReadableBook = Awaited<ReturnType<typeof readableBook>>;
