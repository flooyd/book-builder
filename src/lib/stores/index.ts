import { writable } from 'svelte/store';
import type { User } from 'better-auth';

export type ModalType = 'create' | 'edit' | 'delete';
export type ModalCategory = 'book' | 'part' | 'chapter' | 'character' | 'system';

// Rows as they arrive from the JSON API (timestamps are ISO strings).
export type Book = {
	id: number;
	title: string;
	description: string;
	userId: string;
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
	createdAt: string;
	updatedAt: string;
};
export type Chapter = {
	id: number;
	title: string;
	description: string;
	partId: number;
	createdAt: string;
	updatedAt: string;
};

// app state stores
export const userStore = writable<User | null>(null);
export const modalStore = writable<{
	type: ModalType;
	category: ModalCategory;
	/** Preselects the book (Part, System) or part (Chapter) in the create dialog. */
	bookId?: number;
	partId?: number;
} | null>(null);
export const showMenuStore = writable<boolean>(false);

// The signed-in user's whole library, loaded by the root layout (see $lib/library).
export const booksStore = writable<Book[]>([]);
export const partsStore = writable<Part[]>([]);
export const chaptersStore = writable<Chapter[]>([]);
/** 'loading' until the first load finishes; stays 'ready' during background refreshes. */
export const libraryStatus = writable<'loading' | 'ready' | 'error'>('loading');

// miscellaneous stores
/** Bump to refetch the library after a create, edit or delete. */
export const booksRefresh = writable(0);
