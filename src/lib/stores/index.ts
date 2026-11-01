import { writable, type Writable } from 'svelte/store';
import type { User } from 'better-auth';
import type { GoalsData } from '$lib/goals';
import type { EntryFields, EntryType } from '$lib/bible';
import type { LabelStyle } from '$lib/headings';

export type ModalType = 'create' | 'edit' | 'delete';
export type ModalCategory = 'book' | 'part' | 'chapter' | 'character' | 'place' | 'system';

// Rows as they arrive from the JSON API (timestamps are ISO strings).
export type Book = {
	id: number;
	title: string;
	description: string;
	userId: string;
	/** Random id in the public /read/<shareId> link; null while the book is private. */
	shareId: string | null;
	/** Words the book should reach (see $lib/goals); null when no target is set. */
	targetWords: number | null;
	/** The day ('YYYY-MM-DD') the book should be finished by; null when none is set. */
	deadline: string | null;
	/** How reading mode writes the automatic part labels (see $lib/headings). */
	partLabels: LabelStyle;
	/** How reading mode writes the automatic chapter labels. */
	chapterLabels: LabelStyle;
	/** Off, every chapter goes by its label alone in reading mode. */
	chapterTitles: boolean;
	createdAt: string;
	updatedAt: string;
};
export type Part = {
	id: number;
	title: string;
	description: string;
	bookId: number;
	userId: string;
	/** 1 = holds chapters, 0 = holds its own story text. */
	hasChapters: number;
	/** Show the description as a subtitle in reading mode. */
	showDescription: boolean;
	/** The label above the title in reading mode: null follows the book, '' hides it. */
	headingLabel: string | null;
	/** Show the title in reading mode. */
	showTitle: boolean;
	/** Order within the book. */
	position: number;
	/** Writing status (see $lib/status); used by parts that hold story text. */
	status: string;
	createdAt: string;
	updatedAt: string;
};
export type Chapter = {
	id: number;
	title: string;
	description: string;
	partId: number;
	/** Show the description as a subtitle in reading mode. */
	showDescription: boolean;
	/** The label above the title in reading mode: null follows the book, '' hides it. */
	headingLabel: string | null;
	/** Show the title in reading mode. */
	showTitle: boolean;
	/** Order within the part. */
	position: number;
	/** Writing status (see $lib/status). */
	status: string;
	createdAt: string;
	updatedAt: string;
};

export type Character = EntryFields;
export type Place = EntryFields & {
	/** Free-form label such as "Moon" or "Station"; may be empty. */
	kind: string;
};
export type System = EntryFields & {
	/** Free-form label such as "Magic" or "Law"; may be empty. */
	kind: string;
};
/** A story bible entry of any type (see $lib/bible). */
export type Entry = Character | Place | System;

// app state stores
export const userStore = writable<User | null>(null);
export const modalStore = writable<{
	type: ModalType;
	category: ModalCategory;
	/** Preselects the book (Part, Character, System) or part (Chapter) in the create dialog. */
	bookId?: number;
	partId?: number;
	/** With type 'edit' and category 'system': the system to edit. */
	systemId?: number;
	/** Hands a new character, place or system back, instead of opening its page. */
	oncreate?: (type: EntryType, id: number) => void;
} | null>(null);
export const showMenuStore = writable<boolean>(false);

// The signed-in user's whole library, loaded by the root layout (see $lib/library).
export const booksStore = writable<Book[]>([]);
export const partsStore = writable<Part[]>([]);
export const chaptersStore = writable<Chapter[]>([]);
export const charactersStore = writable<Character[]>([]);
export const placesStore = writable<Place[]>([]);
export const systemsStore = writable<System[]>([]);
/** The store that holds each type of story bible entry. */
export const entryStores: Record<EntryType, Writable<Entry[]>> = {
	character: charactersStore,
	place: placesStore as Writable<Entry[]>,
	system: systemsStore as Writable<Entry[]>
};
/** The writer's daily target, recent days and book progress; null until loaded (see $lib/goals). */
export const goalsStore = writable<GoalsData | null>(null);
/** 'loading' until the first load finishes; stays 'ready' during background refreshes. */
export const libraryStatus = writable<'loading' | 'ready' | 'error'>('loading');

// miscellaneous stores
/** Bump to refetch the library after a create, edit or delete. */
export const booksRefresh = writable(0);
