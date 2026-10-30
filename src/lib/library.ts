import { get } from 'svelte/store';
import {
	booksStore,
	partsStore,
	chaptersStore,
	charactersStore,
	systemsStore,
	libraryStatus,
	type Book,
	type Chapter,
	type Character,
	type Part,
	type System
} from '$lib/stores';

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

/** Fetch the signed-in user's books, parts, chapters, characters and systems into the stores. */
export async function loadLibrary() {
	const run = ++generation;
	// Characters and systems are extras: if they fail to load, the rest of the library still works.
	const extras = Promise.allSettled([
		getJSON<Character[]>('/api/characters'),
		getJSON<System[]>('/api/systems')
	]);
	try {
		const [books, parts, chapters] = await Promise.all([
			getJSON<Book[]>('/api/books'),
			getJSON<Part[]>('/api/parts'),
			getJSON<Chapter[]>('/api/chapters')
		]);
		const [characters, systems] = await extras;
		if (run !== generation) return; // superseded by a newer load or a sign-out
		booksStore.set(books);
		partsStore.set(parts);
		chaptersStore.set(chapters);
		if (characters.status === 'fulfilled') charactersStore.set(characters.value);
		if (systems.status === 'fulfilled') systemsStore.set(systems.value);
		libraryStatus.set('ready');
	} catch {
		if (run !== generation) return;
		// Keep showing what we have if a background refresh fails.
		if (get(libraryStatus) !== 'ready') libraryStatus.set('error');
	}
}

export function clearLibrary() {
	generation++;
	booksStore.set([]);
	partsStore.set([]);
	chaptersStore.set([]);
	charactersStore.set([]);
	systemsStore.set([]);
	libraryStatus.set('loading');
}

/** Up to two initials for a monogram, e.g. "Maren Toll" -> "MT". */
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

const ORDINALS = [
	'One',
	'Two',
	'Three',
	'Four',
	'Five',
	'Six',
	'Seven',
	'Eight',
	'Nine',
	'Ten',
	'Eleven',
	'Twelve',
	'Thirteen',
	'Fourteen',
	'Fifteen',
	'Sixteen',
	'Seventeen',
	'Eighteen',
	'Nineteen',
	'Twenty'
];

/** "Part One", "Part Two" … for the nth (1-based) chapter-holding part. */
export const partLabel = (n: number) => `Part ${ORDINALS[n - 1] ?? n}`;

/** What ordering needs of a part or chapter (reading mode passes trimmed-down rows). */
type OutlinePartRow = Pick<Part, 'id' | 'bookId' | 'hasChapters' | 'position' | 'createdAt'>;
type OutlineChapterRow = Pick<Chapter, 'id' | 'partId' | 'position' | 'createdAt'>;

export type OutlinePart<P extends OutlinePartRow = Part, C extends OutlineChapterRow = Chapter> = {
	part: P;
	/** "Part One" etc. for parts that hold chapters; null for story-text parts. */
	label: string | null;
	chapters: { chapter: C; number: number }[];
};

/**
 * A book's parts in outline order, with chapter numbers running continuously across the
 * whole book. Story-text parts (hasChapters = 0) carry no chapters and don't take a part number.
 */
export function bookOutline<P extends OutlinePartRow, C extends OutlineChapterRow>(
	bookId: number,
	parts: P[],
	chapters: C[]
): OutlinePart<P, C>[] {
	let ordinal = 0;
	let number = 0;
	return parts
		.filter((part) => part.bookId === bookId)
		.sort(byPosition)
		.map((part) => {
			if (!part.hasChapters) return { part, label: null, chapters: [] };
			ordinal += 1;
			return {
				part,
				label: partLabel(ordinal),
				chapters: chapters
					.filter((chapter) => chapter.partId === part.id)
					.sort(byPosition)
					.map((chapter) => ({ chapter, number: ++number }))
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
