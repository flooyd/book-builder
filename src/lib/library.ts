import { get } from 'svelte/store';
import {
	booksStore,
	partsStore,
	chaptersStore,
	charactersStore,
	entryStores,
	placesStore,
	systemsStore,
	goalsStore,
	libraryStatus,
	type Book,
	type Chapter,
	type Character,
	type Entry,
	type Part,
	type Place,
	type System
} from '$lib/stores';
import { TIME_ZONE_COOKIE, type GoalsData } from '$lib/goals';
import { ENTRY_COPY, type EntryType } from '$lib/bible';
import { numberWords, type Noun } from '$lib/headings';

async function getJSON<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
	return (await response.json()) as T;
}

/** Send a JSON body and return the JSON response; throws an Error carrying the server's message. */
export async function sendJSON<T>(
	method: 'POST' | 'PUT' | 'DELETE',
	url: string,
	body?: unknown
): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await response.json().catch(() => null);
	if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status}).`);
	return data as T;
}

/** PUT a JSON body and return the JSON response; throws an Error carrying the server's message. */
export const putJSON = <T>(url: string, body: unknown) => sendJSON<T>('PUT', url, body);

let generation = 0;

/** Fetch the signed-in user's books, parts, chapters and story bible into the stores. */
export async function loadLibrary() {
	const run = ++generation;
	// The story bible and goals are extras: if they fail to load, the rest of the library still
	// works.
	const extras = Promise.allSettled([
		getJSON<Character[]>('/api/characters'),
		getJSON<Place[]>('/api/places'),
		getJSON<System[]>('/api/systems'),
		getJSON<GoalsData>('/api/goals')
	]);
	try {
		const [books, parts, chapters] = await Promise.all([
			getJSON<Book[]>('/api/books'),
			getJSON<Part[]>('/api/parts'),
			getJSON<Chapter[]>('/api/chapters')
		]);
		const [characters, places, systems, goals] = await extras;
		if (run !== generation) return; // superseded by a newer load or a sign-out
		booksStore.set(books);
		partsStore.set(parts);
		chaptersStore.set(chapters);
		if (characters.status === 'fulfilled') charactersStore.set(characters.value);
		if (places.status === 'fulfilled') placesStore.set(places.value);
		if (systems.status === 'fulfilled') systemsStore.set(systems.value);
		if (goals.status === 'fulfilled') goalsStore.set(goals.value);
		libraryStatus.set('ready');
	} catch {
		if (run !== generation) return;
		// Keep showing what we have if a background refresh fails.
		if (get(libraryStatus) !== 'ready') libraryStatus.set('error');
	}
}

/**
 * Story text was saved at `at`: its chapter (or story-text part), the part above and the book
 * show as updated then, as the server recorded.
 */
export function touchLibrary(target: 'part' | 'chapter', id: number, at: string) {
	const partId =
		target === 'part' ? id : get(chaptersStore).find((chapter) => chapter.id === id)?.partId;
	const bookId = get(partsStore).find((part) => part.id === partId)?.bookId;
	if (target === 'chapter') {
		chaptersStore.update((list) => list.map((c) => (c.id === id ? { ...c, updatedAt: at } : c)));
	}
	partsStore.update((list) => list.map((p) => (p.id === partId ? { ...p, updatedAt: at } : p)));
	booksStore.update((list) => list.map((b) => (b.id === bookId ? { ...b, updatedAt: at } : b)));
}

export function clearLibrary() {
	generation++;
	booksStore.set([]);
	partsStore.set([]);
	chaptersStore.set([]);
	charactersStore.set([]);
	placesStore.set([]);
	systemsStore.set([]);
	goalsStore.set(null);
	libraryStatus.set('loading');
}

/**
 * A save added `delta` words to a chapter (or story-text part) and brought today's tally to
 * `today`, as the server counted. Today's tally and the book's progress follow at once.
 */
export function recordWriting(
	target: 'part' | 'chapter',
	id: number,
	writing: { day: string; delta: number; today: number }
) {
	const partId =
		target === 'part' ? id : get(chaptersStore).find((chapter) => chapter.id === id)?.partId;
	const bookId = get(partsStore).find((part) => part.id === partId)?.bookId;
	goalsStore.update((goals) => {
		if (!goals) return goals;
		const bookWords = { ...goals.bookWords };
		if (bookId !== undefined && bookId in bookWords) bookWords[bookId] += writing.delta;
		return {
			...goals,
			today: writing.day,
			days: { ...goals.days, [writing.day]: writing.today },
			bookWords
		};
	});
}

/** A save brought these entries into the book by mentioning them: show them there at once. */
export function recordMentions(
	target: 'part' | 'chapter',
	id: number,
	linked: { type: EntryType; id: number }[]
) {
	const partId =
		target === 'part' ? id : get(chaptersStore).find((chapter) => chapter.id === id)?.partId;
	const bookId = get(partsStore).find((part) => part.id === partId)?.bookId;
	if (bookId === undefined) return;
	for (const item of linked) {
		entryStores[item.type].update((list) =>
			list.map((entry) =>
				entry.id === item.id && !entry.bookIds.includes(bookId)
					? { ...entry, bookIds: [...entry.bookIds, bookId] }
					: entry
			)
		);
	}
}

/** Add a story bible entry to a book and to the library. */
export async function createEntry(type: EntryType, name: string, bookId: number) {
	const entry = await sendJSON<Entry>('POST', ENTRY_COPY[type].api, { name, bookIds: [bookId] });
	entryStores[type].update((list) => [...list, entry]);
	return entry;
}

/** Tell the server which time zone the writer is in, so "today" means their today. */
export function syncTimeZone() {
	const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (!zone) return;
	document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
}

/** Up to two initials for a monogram, e.g. "Juno Halley" -> "JH". */
export function initials(name: string) {
	const words = name.split(/\s+/).filter((word) => word && !/^(the|a|an|of)$/i.test(word));
	return (
		(words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? name).charAt(0))
			.toUpperCase()
			.trim() || '?'
	);
}

// ---- Derived structure -------------------------------------------------------------------

/** Outline order: position (set by the outline), then oldest first. */
const byPosition = <T extends { id: number; position: number; createdAt: string }>(a: T, b: T) =>
	a.position - b.position || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;

/** What ordering needs of a part or chapter (reading mode passes trimmed-down rows). */
type OutlinePartRow = Pick<
	Part,
	'id' | 'bookId' | 'hasChapters' | 'position' | 'createdAt' | 'headingLabel'
>;
type OutlineChapterRow = Pick<Chapter, 'id' | 'partId' | 'position' | 'createdAt' | 'headingLabel'>;

export type OutlinePart<P extends OutlinePartRow = Part, C extends OutlineChapterRow = Chapter> = {
	part: P;
	/** What the writing pages call it: "Part One", its own label or "Part"; null for story text. */
	label: string | null;
	/** Its number among the parts that take one; null for the rest. */
	number: number | null;
	/** The number it has or would take on an automatic label; null for story-text parts. */
	place: number | null;
	chapters: {
		chapter: C;
		number: number | null;
		place: number;
		/** "Chapter 3", its own label or "Chapter". */
		label: string;
	}[];
};

/** What the writing pages call a part or chapter, whatever style the book reads in. */
const writingLabel = (noun: Noun, own: string | null, number: number | null) =>
	number === null ? own || noun : `${noun} ${noun === 'Part' ? numberWords(number) : number}`;

/**
 * A book's parts in outline order. Numbers run continuously across the whole book, and only
 * parts and chapters on an automatic label take one (see $lib/headings). Story-text parts
 * (hasChapters = 0) carry no chapters and never take a number.
 */
export function bookOutline<P extends OutlinePartRow, C extends OutlineChapterRow>(
	bookId: number,
	parts: P[],
	chapters: C[]
): OutlinePart<P, C>[] {
	let partNumber = 0;
	let chapterNumber = 0;
	return parts
		.filter((part) => part.bookId === bookId)
		.sort(byPosition)
		.map((part) => {
			if (!part.hasChapters) {
				return { part, label: null, number: null, place: null, chapters: [] };
			}
			const place = partNumber + 1;
			const number = part.headingLabel === null ? ++partNumber : null;
			return {
				part,
				label: writingLabel('Part', part.headingLabel, number),
				number,
				place,
				chapters: chapters
					.filter((chapter) => chapter.partId === part.id)
					.sort(byPosition)
					.map((chapter) => {
						const place = chapterNumber + 1;
						const number = chapter.headingLabel === null ? ++chapterNumber : null;
						return {
							chapter,
							number,
							place,
							label: writingLabel('Chapter', chapter.headingLabel, number)
						};
					})
			};
		});
}

/** The most recently updated chapter in an outline, if any. */
export function latestChapterId(outline: OutlinePart[]) {
	let latest: Chapter | undefined;
	for (const entry of outline) {
		for (const { chapter } of entry.chapters) {
			if (!latest || Date.parse(chapter.updatedAt) > Date.parse(latest.updatedAt)) latest = chapter;
		}
	}
	return latest?.id;
}

// ---- Formatting --------------------------------------------------------------------------

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** Calendar-day relative date: "today", "yesterday", "3 days ago", "last week", "2 months ago". */
export function relativeDay(value: string | Date, now = new Date()) {
	const date = new Date(value);
	const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const days = Math.min(0, Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000));
	if (days > -7) return relative.format(days, 'day');
	if (days > -30) return relative.format(Math.round(days / 7), 'week');
	if (days > -365) return relative.format(Math.round(days / 30), 'month');
	return relative.format(Math.round(days / 365), 'year');
}
