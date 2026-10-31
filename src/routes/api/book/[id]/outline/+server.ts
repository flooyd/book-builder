import { json, type RequestEvent } from '@sveltejs/kit';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { chapter, chapterCharacter, part, partCharacter } from '$lib/server/db/schema';
import { descriptionField, findOwnedBook, textField } from '$lib/server/ownership';
import { storyTexts } from '$lib/server/outline';
import { countWords } from '$lib/reading';
import { plainText } from '$lib/rich';

async function ownedBook(event: RequestEvent) {
	const user = requireUser(event);
	const id = Number(event.params.id);
	return Number.isInteger(id) ? findOwnedBook(user.id, id) : undefined;
}

// What the outline shows beyond the rows in the stores: word counts and casts, keyed like the
// section anchors ("part-3", "chapter-12").
export const GET = async (event: RequestEvent) => {
	const found = await ownedBook(event);
	if (!found) return json({ error: 'Book not found' }, { status: 404 });

	const parts = await db.select({ id: part.id }).from(part).where(eq(part.bookId, found.id));
	const partIds = parts.map((p) => p.id);
	const chapters = partIds.length
		? await db.select({ id: chapter.id }).from(chapter).where(inArray(chapter.partId, partIds))
		: [];
	const chapterIds = chapters.map((c) => c.id);

	const words: Record<string, number> = {};
	for (const [key, content] of Object.entries(await storyTexts(partIds, chapterIds))) {
		words[key] = countWords(plainText(content));
	}

	const cast: Record<string, number[]> = {};
	const add = (key: string, characterId: number) => (cast[key] ??= []).push(characterId);
	if (chapterIds.length) {
		const rows = await db
			.select()
			.from(chapterCharacter)
			.where(inArray(chapterCharacter.chapterId, chapterIds));
		for (const row of rows) add(`chapter-${row.chapterId}`, row.characterId);
	}
	if (partIds.length) {
		const rows = await db
			.select()
			.from(partCharacter)
			.where(inArray(partCharacter.partId, partIds));
		for (const row of rows) add(`part-${row.partId}`, row.characterId);
	}

	return json({ words, cast });
};

type Draft = { title: string; description: string };

function readDrafts(value: unknown): Draft[] | null {
	if (value === undefined) return [];
	if (!Array.isArray(value)) return null;
	const drafts = value.map((item) => ({
		title: textField(item?.title),
		description: descriptionField(item?.description)
	}));
	return drafts.every((draft) => draft.title) ? drafts : null;
}

const MAX_ITEMS = 500;

/**
 * Add many parts and chapters at once (the outline's "Import from text"), in one transaction:
 * `chapters` go at the end of the part `intoPartId`, then `parts` (each with its own `chapters`)
 * at the end of the book. Returns the new rows.
 */
export const POST = async (event: RequestEvent) => {
	const found = await ownedBook(event);
	if (!found) return json({ error: 'Book not found' }, { status: 404 });

	const body = await event.request.json().catch(() => null);
	const loose = readDrafts(body?.chapters);
	const newParts = Array.isArray(body?.parts)
		? body.parts.map((item: Record<string, unknown>) => ({
				title: textField(item?.title),
				description: descriptionField(item?.description),
				hasChapters: item?.hasChapters === false ? 0 : 1,
				chapters: readDrafts(item?.chapters)
			}))
		: body?.parts === undefined
			? []
			: null;

	if (
		!loose ||
		!newParts ||
		newParts.some(
			(p: { title: string; hasChapters: number; chapters: Draft[] | null }) =>
				!p.title || !p.chapters || (!p.hasChapters && p.chapters.length > 0)
		)
	) {
		return json({ error: 'Every part and chapter needs a title' }, { status: 400 });
	}
	const total =
		loose.length +
		newParts.reduce((sum: number, p: { chapters: Draft[] }) => sum + 1 + p.chapters.length, 0);
	if (total === 0) return json({ error: 'Nothing to add' }, { status: 400 });
	if (total > MAX_ITEMS) {
		return json({ error: `Add at most ${MAX_ITEMS} parts and chapters at once` }, { status: 400 });
	}

	let intoPartId: number | null = null;
	if (loose.length) {
		intoPartId = Number(body?.intoPartId);
		const [target] = Number.isInteger(intoPartId)
			? await db
					.select({ hasChapters: part.hasChapters })
					.from(part)
					.where(and(eq(part.id, intoPartId), eq(part.bookId, found.id)))
			: [];
		if (!target?.hasChapters) {
			return json({ error: 'Choose a part of this book that holds chapters' }, { status: 400 });
		}
	}

	const created = await db.transaction(async (tx) => {
		const createdParts: (typeof part.$inferSelect)[] = [];
		const createdChapters: (typeof chapter.$inferSelect)[] = [];

		if (intoPartId !== null) {
			const [{ next }] = await tx
				.select({ next: sql<number>`coalesce(max(${chapter.position}), -1)::int + 1` })
				.from(chapter)
				.where(eq(chapter.partId, intoPartId));
			createdChapters.push(
				...(await tx
					.insert(chapter)
					.values(loose.map((draft, i) => ({ ...draft, partId: intoPartId!, position: next + i })))
					.returning())
			);
		}

		const [{ nextPart }] = await tx
			.select({ nextPart: sql<number>`coalesce(max(${part.position}), -1)::int + 1` })
			.from(part)
			.where(eq(part.bookId, found.id));
		for (const [i, draft] of newParts.entries()) {
			const [row] = await tx
				.insert(part)
				.values({
					title: draft.title,
					description: draft.description,
					hasChapters: draft.hasChapters,
					bookId: found.id,
					userId: found.userId,
					position: nextPart + i
				})
				.returning();
			createdParts.push(row);
			if (draft.chapters.length) {
				createdChapters.push(
					...(await tx
						.insert(chapter)
						.values(
							draft.chapters.map((c: Draft, position: number) => ({
								...c,
								partId: row.id,
								position
							}))
						)
						.returning())
				);
			}
		}
		return { parts: createdParts, chapters: createdChapters };
	});

	return json(created);
};
