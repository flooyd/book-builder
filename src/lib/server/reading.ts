import { asc, eq, inArray, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book, chapter, part, storyText, user } from '$lib/server/db/schema';

const iso = (date: Date) => date.toISOString();

/**
 * Everything reading mode shows of a book, and nothing else: titles, the descriptions the writer
 * chose to show (hidden ones may be private notes, so they are blanked here, not in the page),
 * the story texts and the author's name. Shared by the owner's /book/[id]/read and the public
 * /read/[shareId], which anyone can open.
 */
export async function readableBook(found: typeof book.$inferSelect) {
	const parts = await db.select().from(part).where(eq(part.bookId, found.id));
	const partIds = parts.map((p) => p.id);
	const chapters = partIds.length
		? await db.select().from(chapter).where(inArray(chapter.partId, partIds))
		: [];
	const chapterIds = chapters.map((c) => c.id);

	const rows = partIds.length
		? await db
				.select({
					partId: storyText.partId,
					chapterId: storyText.chapterId,
					content: storyText.content
				})
				.from(storyText)
				.where(
					or(
						inArray(storyText.partId, partIds),
						chapterIds.length ? inArray(storyText.chapterId, chapterIds) : undefined
					)
				)
				.orderBy(asc(storyText.createdAt))
		: [];

	// Keyed like the section anchors ("part-3", "chapter-12"); the oldest row wins, as in the
	// editor.
	const texts: Record<string, string> = {};
	for (const row of rows) {
		const key = row.chapterId ? `chapter-${row.chapterId}` : `part-${row.partId}`;
		texts[key] ??= row.content;
	}

	const [author] = await db
		.select({ name: user.name })
		.from(user)
		.where(eq(user.id, found.userId))
		.limit(1);

	return {
		book: { id: found.id, title: found.title, description: found.description },
		// ISO timestamps, as in the client stores, so bookOutline orders them the same way.
		parts: parts.map((p) => ({
			id: p.id,
			bookId: p.bookId,
			title: p.title,
			description: p.showDescription ? p.description : '',
			hasChapters: p.hasChapters,
			createdAt: iso(p.createdAt)
		})),
		chapters: chapters.map((c) => ({
			id: c.id,
			partId: c.partId,
			title: c.title,
			description: c.showDescription ? c.description : '',
			createdAt: iso(c.createdAt)
		})),
		texts,
		author: author?.name ?? ''
	};
}

export type ReadableBook = Awaited<ReturnType<typeof readableBook>>;
