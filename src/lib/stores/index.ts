import { writable } from "svelte/store";

export type ModalType = 'create' | 'edit' | 'delete';
export type ModalCategory = 'book' | 'part' | 'chapter' | 'character' | 'system';


// app state stores
export const userStore = writable<any | null>(null);
export const modalStore = writable<{ type: ModalType, category: ModalCategory, title?: string, part?: string, chapter?: string, character?: string, system?: string } | null>(null);
export const showMenuStore = writable<boolean>(false);

//category stores
export const bookStore = writable<any | null>(null);
export const booksStore = writable<any[]>([]);
export const partStore = writable<any | null>(null);
export const partsStore = writable<any[]>([]);

// miscellaneous stores
export const booksRefresh = writable(0);
export const category = writable<ModalCategory | null>(null);
export const type = writable<ModalType | null>(null);