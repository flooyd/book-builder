import { get } from 'svelte/store';
import {
	booksStore,
	partsStore,
	chaptersStore,
	libraryStatus,
	type Book,
	type Chapter,
	type Part
} from '$lib/stores';

async function getJSON<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}`);
	return (await response.json()) as T;
}

let generation = 0;

/** Fetch the signed-in user's books, parts and chapters into the stores. */
export async function loadLibrary() {
	const run = ++generation;
	try {
		const [books, parts, chapters] = await Promise.all([
			getJSON<Book[]>('/api/books'),
			getJSON<Part[]>('/api/parts'),
			getJSON<Chapter[]>('/api/chapters')
		]);
		if (run !== generation) return; // superseded by a newer load or a sign-out
		booksStore.set(books);
		partsStore.set(parts);
		chaptersStore.set(chapters);
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
	libraryStatus.set('loading');
}

// ---- Derived structure -------------------------------------------------------------------

const byCreated = <T extends { id: number; createdAt: string }>(a: T, b: T) =>
	Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;

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

export type OutlinePart = {
	part: Part;
	/** "Part One" etc. for parts that hold chapters; null for story-text parts. */
	label: string | null;
	chapters: { chapter: Chapter; number: number }[];
};

/**
 * A book's parts in order (oldest first), with chapter numbers running continuously across the
 * whole book. Story-text parts (hasChapters = 0) carry no chapters and don't take a part number.
 */
export function bookOutline(bookId: number, parts: Part[], chapters: Chapter[]): OutlinePart[] {
	let ordinal = 0;
	let number = 0;
	return parts
		.filter((part) => part.bookId === bookId)
		.sort(byCreated)
		.map((part) => {
			if (!part.hasChapters) return { part, label: null, chapters: [] };
			ordinal += 1;
			return {
				part,
				label: partLabel(ordinal),
				chapters: chapters
					.filter((chapter) => chapter.partId === part.id)
					.sort(byCreated)
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
