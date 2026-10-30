import type { Kind, Place } from '$lib/outline.svelte';

/** A part or chapter as the outline shows it. */
export type Item = {
	kind: Kind;
	id: number;
	/** "part-3", "chapter-12": also the base of element ids ("title-chapter-12"). */
	key: string;
	title: string;
	description: string;
	showDescription: boolean;
	status: string;
	/** "Part One", "Chapter 3"; null for parts that hold story text. */
	label: string | null;
	number: number | null;
	/** Parts: holds chapters (true) or its own story text (false). Chapters: false. */
	holdsChapters: boolean;
	/** Chapters: the part they're in. */
	partId: number | null;
	/** Words of story text; for parts that hold chapters, of all their chapters. */
	words: number;
	cast: number[];
};

export type Group = { part: Item; chapters: Item[] };

/** What the views need from the outline page. */
export interface OutlineUi {
	readonly selected: string | null;
	/** Key of the item being dragged. */
	readonly dragging: string | null;
	/** False while searching or filtering: the order on screen isn't the whole book. */
	readonly canReorder: boolean;
	readonly synopses: boolean;
	/** The book's characters by id. */
	readonly characters: Record<number, { id: number; name: string }>;
	select(key: string): void;
	/** Select, and on narrow screens open the details. */
	details(key: string): void;
	save(item: Item, changes: Record<string, unknown>): Promise<boolean>;
	titleKeys(item: Item, event: KeyboardEvent): void;
	gripKeys(item: Item, event: KeyboardEvent): void;
	drag(
		item: Item,
		event: PointerEvent,
		element: HTMLElement,
		locate: (x: number, y: number) => Place | null,
		scroller?: HTMLElement | null
	): void;
	addChapter(partId: number, after?: number | null): void;
	addPart(hasChapters: boolean, after?: number): void;
}
