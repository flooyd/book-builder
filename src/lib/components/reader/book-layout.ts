// Book view: how big the pages are, and the run of pages a book is laid out into.
//
// The story text isn't split up here. Each part or chapter with text is a "flow" set in CSS
// columns exactly one page wide, so the browser breaks it into pages (formatting, first letters
// and scene breaks included); a page shows one column of its flow. Measuring tells us how many
// columns each flow takes, and buildPages strings the pages together around them.

import type { ReadingPosition } from '$lib/reading';

export type Geometry = {
	/** One page at a time (phones, portrait tablets) rather than an open spread. */
	single: boolean;
	/** Page width and height. */
	pw: number;
	ph: number;
	/** Margins: the running head sits in the top one, the page number in the bottom one. */
	padX: number;
	padTop: number;
	padBottom: number;
	/** The text block. */
	cw: number;
	ch: number;
	/** Gap between columns, i.e. between pages of a flow. */
	gap: number;
	/** Body text size in px. */
	font: number;
	/** How far the cover boards stand out past the pages. */
	overhang: number;
};

/** Page geometry for the space the book has, at the reader's text size. */
export function geometryFor(width: number, height: number, textSize: number): Geometry {
	const single = width < 860 || width < height * 1.1;
	let pw: number;
	let ph: number;
	if (single) {
		pw = Math.floor(Math.min(width - 24, 620));
		ph = Math.floor(Math.min(height - 28, pw * 1.75));
	} else {
		pw = Math.floor(Math.min((width - 80) / 2, (height - 56) / 1.36, 620));
		ph = Math.floor(pw * 1.36);
	}
	const padX = single ? Math.round(Math.min(44, Math.max(20, pw * 0.07))) : Math.round(pw * 0.095);
	const padTop = single ? 42 : Math.round(ph * 0.075);
	const padBottom = single ? 40 : Math.round(ph * 0.075);
	// Smaller pages take a slightly smaller size, as a paperback does.
	const scale = single ? 0.92 : Math.min(0.92, Math.max(0.78, pw / 640));
	return {
		single,
		pw,
		ph,
		padX,
		padTop,
		padBottom,
		cw: pw - 2 * padX,
		ch: ph - padTop - padBottom,
		gap: 2 * padX,
		font: Math.round(textSize * scale * 10) / 10,
		overhang: Math.max(8, Math.round(pw * 0.028))
	};
}

/** What goes into the book, in order: part title pages and flows of text. */
export type BookItem =
	| { kind: 'part'; key: string; entry: number }
	| { kind: 'text'; key: string; flow: number; title: string };

export type BookPage = (
	| { kind: 'endpaper' | 'title' | 'end' | 'blank' | 'empty' }
	| { kind: 'contents'; column: number }
	| { kind: 'part'; key: string; entry: number }
	| { kind: 'text'; key: string; flow: number; column: number; columns: number }
) & {
	/** The number counted from the title page, printed on pages of text and contents. */
	folio: number;
	printFolio: boolean;
	/** Running head: the book's title on the left, the chapter's on the right. */
	head: string | null;
};

export type BookLayout = {
	pages: BookPage[];
	/** First page of each part and chapter, by key. */
	startOf: Record<string, number>;
};

/**
 * Strings the pages together. An open book starts with the endpaper facing the title page and
 * keeps part title pages on the right, adding a blank page where needed; one page at a time
 * needs neither.
 */
export function buildPages(
	items: BookItem[],
	columns: number[],
	contentsColumns: number,
	single: boolean,
	bookTitle: string
): BookLayout {
	type Draft =
		| { kind: 'endpaper' | 'title' | 'end' | 'blank' | 'empty' }
		| { kind: 'contents'; column: number }
		| { kind: 'part'; key: string; entry: number }
		| { kind: 'text'; key: string; flow: number; column: number; columns: number; title: string };
	const drafts: Draft[] = [];
	const startOf: Record<string, number> = {};

	if (!single) drafts.push({ kind: 'endpaper' });
	drafts.push({ kind: 'title' });
	if (items.length === 0) {
		drafts.push({ kind: 'empty' });
	} else {
		for (let column = 0; column < contentsColumns; column++)
			drafts.push({ kind: 'contents', column });
		for (const item of items) {
			if (item.kind === 'part') {
				// Right-hand pages have odd indexes (the title page is 1).
				if (!single && drafts.length % 2 === 0) drafts.push({ kind: 'blank' });
				startOf[item.key] = drafts.length;
				drafts.push(item);
			} else {
				startOf[item.key] = drafts.length;
				const count = Math.max(1, columns[item.flow] ?? 1);
				for (let column = 0; column < count; column++) {
					drafts.push({ ...item, column, columns: count });
				}
			}
		}
		drafts.push({ kind: 'end' });
	}
	if (!single && drafts.length % 2 === 1) drafts.push({ kind: 'endpaper' });

	const pages = drafts.map((draft, index): BookPage => {
		const folio = single ? index + 1 : index;
		const left = !single && index % 2 === 0;
		if (draft.kind === 'text') {
			const { title, ...page } = draft;
			return {
				...page,
				folio,
				printFolio: true,
				// Not over the opening page of a chapter.
				head: draft.column === 0 ? null : left ? bookTitle : title
			};
		}
		if (draft.kind === 'contents') {
			return { ...draft, folio, printFolio: true, head: draft.column === 0 ? null : 'Contents' };
		}
		return { ...draft, folio, printFolio: false, head: null };
	});
	return { pages, startOf };
}

/** Where a page is in the book, or null on the pages around the story (title, contents). */
export function positionOf(page: BookPage | undefined): ReadingPosition | null {
	if (page?.kind === 'part') return { key: page.key, fraction: 0 };
	// The middle of the page, so the way back lands on this page and not the one before.
	if (page?.kind === 'text') return { key: page.key, fraction: (page.column + 0.5) / page.columns };
	return null;
}

/** The page a position falls on. */
export function pageOf(layout: BookLayout, at: ReadingPosition): number | null {
	const start = layout.startOf[at.key];
	if (start === undefined) return null;
	const page = layout.pages[start];
	if (page.kind !== 'text') return start;
	const column = Math.min(page.columns - 1, Math.max(0, Math.floor(at.fraction * page.columns)));
	return start + column;
}
