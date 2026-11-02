import { eq, inArray } from 'drizzle-orm';
import { firstName, lastName, type EntryType } from '$lib/bible';
import {
	analyseManuscript,
	type EntryInput,
	type GroupInput,
	type SectionInput
} from '$lib/insights';
import { bookOutline } from '$lib/library';
import { countWords } from '$lib/reading';
import { mentionsIn, plainText } from '$lib/rich';
import { castsOf, entriesOfBook } from '$lib/server/bible';
import { db } from '$lib/server/db';
import { book, chapter, part } from '$lib/server/db/schema';
import { storyTexts } from '$lib/server/outline';
import { buildWordMaps } from '$lib/word-map';

/** Everything the story might call an entry, for finding it in text with no mentions. */
function namesOf(entry: {
	type: EntryType;
	id: number;
	name: string;
	aliases: string[];
}): EntryInput {
	// Only people go by a single word of their name: the "Lantern" of the Lantern Gate could be any
	// lantern at the start of a sentence. "The Meridian" is plain "Meridian" as often as not.
	const short = entry.type === 'character' ? [firstName(entry.name), lastName(entry.name)] : [];
	const bare = entry.name.replace(/^(?:the|a|an)\s+/i, '');
	return {
		type: entry.type,
		id: entry.id,
		name: entry.name,
		names: [...new Set([entry.name, bare, ...short.filter(Boolean), ...entry.aliases])] as string[]
	};
}

/** How many times story text mentions each entry, keyed "character-1". */
function mentionCounts(value: string) {
	const counts: Record<string, number> = {};
	for (const { entry, id } of mentionsIn(value)) {
		counts[`${entry}-${id}`] = (counts[`${entry}-${id}`] ?? 0) + 1;
	}
	return counts;
}

/**
 * A book as it's saved now, ready to be counted. Unlike reading mode this is for the owner alone, so
 * it uses every real title, hidden or not, and the text with its mentions. It runs in reading order
 * through bookOutline, so its numbers and labels are the ones on the outline.
 */
async function manuscriptOf(found: typeof book.$inferSelect) {
	const parts = await db.select().from(part).where(eq(part.bookId, found.id));
	const partIds = parts.map((row) => row.id);
	const chapters = partIds.length
		? await db.select().from(chapter).where(inArray(chapter.partId, partIds))
		: [];
	const chapterIds = chapters.map((row) => row.id);

	const [texts, casts, entries] = await Promise.all([
		storyTexts(partIds, chapterIds),
		castsOf(partIds, chapterIds),
		entriesOfBook(found.id)
	]);

	const iso = <T extends { createdAt: Date }>(row: T) => ({
		...row,
		createdAt: row.createdAt.toISOString()
	});
	const outline = bookOutline(found.id, parts.map(iso), chapters.map(iso));

	const section = (
		fields: Pick<SectionInput, 'key' | 'target' | 'id' | 'label' | 'title' | 'number' | 'group'>
	): SectionInput => {
		const value = texts[fields.key] ?? '';
		const text = plainText(value);
		const cast = casts[fields.key];
		return {
			...fields,
			lines: text.split('\n').filter((line) => line.trim()),
			words: countWords(text),
			mentions: mentionCounts(value),
			cast: cast
				? Object.entries(cast).flatMap(([type, ids]) => ids.map((id) => `${type}-${id}`))
				: []
		};
	};

	const groups: GroupInput[] = outline.map((entry) => ({
		id: entry.part.id,
		label: entry.label,
		title: entry.part.title
	}));

	const sections = outline.flatMap((entry, group): SectionInput[] => {
		if (!entry.label) {
			const { id, title } = entry.part;
			return [
				section({
					key: `part-${id}`,
					target: 'part',
					id,
					label: title,
					title,
					number: null,
					group
				})
			];
		}
		return entry.chapters.map(({ chapter: row, label, number }) =>
			section({
				key: `chapter-${row.id}`,
				target: 'chapter',
				id: row.id,
				label,
				title: row.title,
				number,
				group
			})
		);
	});

	return { sections, groups, entries: entries.map(namesOf) };
}

export async function manuscriptInsights(found: typeof book.$inferSelect) {
	return analyseManuscript(await manuscriptOf(found));
}

export async function wordMaps(found: typeof book.$inferSelect) {
	return buildWordMaps(await manuscriptOf(found));
}
