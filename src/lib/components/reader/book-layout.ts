// Book view: how big the pages are, and the run of pages a book is laid out into.
//
// The story text isn't split up here. Each part or chapter with text is a "flow" set in CSS
// columns exactly one page wide, so the browser breaks it into pages (formatting, first letters
// and scene breaks included); a page shows one column of its flow. Measuring tells us how many
// columns each flow takes, and buildPages strings the pages together around them.
//
// A flow with footnotes is set differently, because every column is the same height and a note
// belongs at the foot of the page its number is on. It's laid out as one long column, its lines
// are read off (flow-lines.ts), and sliceFlow cuts it into pages between lines, each page a window
// onto the text and another onto the notes, as the PDF sets them.

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

/**
 * What goes into the book, in order: part title pages and flows of text. An anchor is a part
 * with nothing to show: it gets no page, but links to it land on whatever comes next.
 */
export type BookItem =
	| { kind: 'part'; key: string; entry: number }
	| { kind: 'text'; key: string; flow: number; title: string }
	| { kind: 'anchor'; key: string };

export type BookPage = (
	| { kind: 'endpaper' | 'title' | 'end' | 'blank' | 'empty' }
	| { kind: 'contents'; column: number }
	| { kind: 'part'; key: string; entry: number }
	| {
			kind: 'text';
			key: string;
			flow: number;
			column: number;
			columns: number;
			/** In a flow with footnotes, what of it this page shows. */
			slice: Slice | null;
	  }
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
	bookTitle: string,
	/** For each flow with footnotes, its pages (sliceFlow); null for a flow set in columns. */
	slices: (Slice[] | null)[] = []
): BookLayout {
	type Draft =
		| { kind: 'endpaper' | 'title' | 'end' | 'blank' | 'empty' }
		| { kind: 'contents'; column: number }
		| { kind: 'part'; key: string; entry: number }
		| {
				kind: 'text';
				key: string;
				flow: number;
				column: number;
				columns: number;
				slice: Slice | null;
				title: string;
		  };
	const drafts: Draft[] = [];
	const startOf: Record<string, number> = {};

	if (!single) drafts.push({ kind: 'endpaper' });
	drafts.push({ kind: 'title' });
	if (items.every((item) => item.kind === 'anchor')) {
		drafts.push({ kind: 'empty' });
	} else {
		for (let column = 0; column < contentsColumns; column++)
			drafts.push({ kind: 'contents', column });
		for (const item of items) {
			if (item.kind === 'anchor') {
				startOf[item.key] = drafts.length;
			} else if (item.kind === 'part') {
				// Right-hand pages have odd indexes (the title page is 1).
				if (!single && drafts.length % 2 === 0) drafts.push({ kind: 'blank' });
				startOf[item.key] = drafts.length;
				drafts.push(item);
			} else {
				startOf[item.key] = drafts.length;
				const sliced = slices[item.flow];
				const count = Math.max(1, sliced?.length ?? columns[item.flow] ?? 1);
				for (let column = 0; column < count; column++) {
					const slice = sliced ? (sliced[column] ?? { text: null, notes: null }) : null;
					drafts.push({ ...item, column, columns: count, slice });
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
				// Not over the opening page of a chapter. A chapter with no heading goes by the book.
				head: draft.column === 0 ? null : left ? bookTitle : title || bookTitle
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

// ---- Flows with footnotes ----------------------------------------------------------------------

/** A stretch of a flow set as one long column, top to bottom, in px from its top. */
export type Span = { top: number; bottom: number };

/** A line of text in a flow, or a block that isn't split (a heading, a scene break, a picture). */
export type FlowLine = Span & {
	/** The footnotes whose numbers are in it. */
	notes: number[];
	/** A page may end after it: not after a heading, nor where it would leave one line alone. */
	breakAfter: boolean;
	/** It has a page to itself (a picture): a page ends before it and after it. */
	alone?: boolean;
};

/** A line of a flow's notes, set on their own as one long column. */
export type NoteLine = Span & { note: number };

/** One page of a flow with footnotes: the text it shows, and the notes at its foot. */
export type Slice = { text: Span | null; notes: Span | null };

/** The room on a page, for sliceFlow. */
export type SliceRoom = {
	/** The text block's height. */
	height: number;
	/** The space between the text and its notes, where the short rule goes. */
	rule: number;
	/** What the rest of a long note from the page before must leave for text. */
	least: number;
};

/** The room on a page of this size, in px. */
export function sliceRoom(geo: Geometry): SliceRoom {
	return {
		height: geo.ch,
		rule: Math.round(geo.font * 1.4),
		least: Math.round(geo.font * 1.75 * 4)
	};
}

/**
 * Cuts a flow with footnotes into pages, the way the PDF sets them (pdf.ts). A line goes on a
 * page only if its notes fit at the foot of that page too. A note too long for what's left may
 * split, leaving at least two of its lines (or all of a note of three lines or fewer), and the rest
 * goes first at the foot of the next page; nothing else with a note goes on the page it split on,
 * since its note would come after the rest of that one. A page ends where a line allows it
 * (`breakAfter`), or wherever it has to when nothing allows it. Notes still to come when the text
 * runs out get pages of their own.
 */
export function sliceFlow(lines: FlowLine[], notes: NoteLine[], room: SliceRoom): Slice[] {
	// Where each note's lines are in `notes`, by number.
	const first = new Map<number, number>();
	const after = new Map<number, number>();
	notes.forEach((line, index) => {
		if (!first.has(line.note)) first.set(line.note, index);
		after.set(line.note, index + 1);
	});
	/** The notes area for note lines [from, to): their height and the space above them. */
	const foot = (from: number, to: number) =>
		to > from ? notes[to - 1].bottom - notes[from].top + room.rule : 0;
	/** How far into the notes a line's numbers take them. */
	const owedAfter = (line: FlowLine, owed: number) =>
		line.notes.reduce((most, note) => Math.max(most, after.get(note) ?? most), owed);

	type State = { end: number; taken: number; owed: number };
	const slices: Slice[] = [];
	let next = 0; // the first line of text not set yet
	let queued = 0; // the first note line not set yet
	let owed = 0; // note lines before this one have their numbers set already
	while (next < lines.length || queued < notes.length) {
		const more = next < lines.length;
		// Anything left over (a number that wasn't found in the text) goes after the text.
		if (!more) owed = notes.length;
		const top = more ? lines[next].top : 0;

		// The rest of a note from the page before goes first, leaving some room for text.
		let taken = queued;
		const cap = more ? room.height - room.least : room.height;
		while (taken < owed && foot(queued, taken + 1) <= cap) taken++;
		if (taken === queued && queued < owed) taken++;

		let state: State = { end: next, taken, owed };
		let best: State | null = null;
		while (state.end < lines.length) {
			const line = lines[state.end];
			// A page of its own: whatever is already on this page ends it.
			if (line.alone && state.end > next) {
				best = state;
				break;
			}
			let lineOwed = state.owed;
			let lineTaken = state.taken;
			if (line.notes.length) {
				// A note runs on from this page, and this one's note would have to come after it.
				if (state.taken < state.owed) break;
				lineOwed = owedAfter(line, state.owed);
				const text = line.bottom - top;
				while (lineTaken < lineOwed && text + foot(queued, lineTaken + 1) <= room.height) {
					lineTaken++;
				}
				if (lineTaken < lineOwed) {
					const note = notes[lineTaken].note;
					const start = first.get(note) ?? lineTaken;
					const total = (after.get(note) ?? lineTaken) - start;
					if (lineTaken - start < (total <= 3 ? total : 2)) break;
				}
			}
			if (line.bottom - top + foot(queued, lineTaken) > room.height) break;
			state = { end: state.end + 1, taken: lineTaken, owed: lineOwed };
			if (line.breakAfter || state.end === lines.length) best = state;
			if (line.alone) break;
		}

		if (!best) {
			if (state.end > next || taken > queued || !more) {
				// Nothing breaks where it should: as much as fits, or a page of notes alone.
				best = state;
			} else {
				// Not even one line fits (a block taller than the page): it goes here anyway.
				const line = lines[next];
				const lineOwed = owedAfter(line, owed);
				let lineTaken = taken;
				while (
					lineTaken < lineOwed &&
					line.bottom - top + foot(queued, lineTaken + 1) <= room.height
				) {
					lineTaken++;
				}
				best = { end: next + 1, taken: lineTaken, owed: lineOwed };
			}
		}

		slices.push({
			text: best.end > next ? { top, bottom: lines[best.end - 1].bottom } : null,
			notes:
				best.taken > queued
					? { top: notes[queued].top, bottom: notes[best.taken - 1].bottom }
					: null
		});
		next = best.end;
		queued = best.taken;
		owed = best.owed;
	}
	return slices.length ? slices : [{ text: null, notes: null }];
}
