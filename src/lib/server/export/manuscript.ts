import { looksLike, type CoverArt } from '$lib/art';
import { chapterHeading, partHeading, type Heading } from '$lib/headings';
import { bookOutline, type OutlinePart } from '$lib/library';
import { storyWords } from '$lib/reading';
import {
	capOf,
	hasContent,
	parse,
	picturesIn,
	type DropCap,
	type PictureSources,
	type RichNode
} from '$lib/rich';
import { readPicture } from '$lib/server/art-store';
import type { ReadableBook } from '$lib/server/reading';

/**
 * What goes into an exported file, whichever format it is. It's built from readableBook, so an
 * export holds what reading mode shows and nothing else: hidden titles and descriptions may be
 * private notes, and mentions are plain words. The writers (pdf.ts, word.ts) only set the type.
 */

/** A part or chapter in reading order. */
export type Section = {
	/** Its anchor, as in reading mode: "part-3", "chapter-12". */
	key: string;
	/** A part's own page, which holds no story text, or anything that can. */
	kind: 'part' | 'text';
	/** 0 for parts, 1 for the chapters in them. */
	depth: 0 | 1;
	over: string | null;
	title: string;
	/** In the contents, an automatic chapter label comes down to this number. */
	short: string | null;
	/** Stored values, so blank when there's nothing to show. */
	description: string;
	text: string;
};

export type Manuscript = {
	/** The book's id, which picks its cover. */
	id: number;
	title: string;
	author: string;
	/** The book's description, for the title page. */
	blurb: string;
	/** The writer's picture for the cover, if the book has one. */
	cover: CoverArt | null;
	/** Set when one part is exported rather than the book, whose title page it then opens. */
	part: (Heading & { description: string; name: string }) | null;
	sections: Section[];
	/** Where the pictures set in the text are, from the author's shelf. */
	pictures: PictureSources;
};

type Entry = OutlinePart<ReadableBook['parts'][number], ReadableBook['chapters'][number]>;

function chapterSections(entry: Entry, data: ReadableBook): Section[] {
	return entry.chapters.map((item) => {
		const key = `chapter-${item.chapter.id}`;
		return {
			key,
			kind: 'text',
			depth: 1,
			...chapterHeading(item, data.book),
			description: item.chapter.description,
			text: data.texts[key] ?? ''
		};
	});
}

function partSection(entry: Entry, data: ReadableBook, kind: Section['kind']): Section {
	const key = `part-${entry.part.id}`;
	return {
		key,
		kind,
		depth: 0,
		...partHeading(entry, data.book),
		description: entry.part.description,
		text: kind === 'text' ? (data.texts[key] ?? '') : ''
	};
}

const front = (data: ReadableBook) => ({
	id: data.book.id,
	title: data.book.title,
	author: data.author,
	blurb: data.book.description,
	cover: data.book.cover,
	pictures: data.pictures
});

const outlineOf = (data: ReadableBook) => bookOutline(data.book.id, data.parts, data.chapters);

/** The whole book. As in reading mode, a part with nothing to show gets no page of its own. */
export function bookManuscript(data: ReadableBook): Manuscript {
	const sections = outlineOf(data).flatMap((entry) => {
		if (!entry.label) return [partSection(entry, data, 'text')];
		const section = partSection(entry, data, 'part');
		const page = section.title || section.description;
		return [...(page ? [section] : []), ...chapterSections(entry, data)];
	});
	return { ...front(data), part: null, sections };
}

/**
 * One part. Its chapters keep the numbers they have in the book, and the title page does the job
 * of the part's own page. Null if the part isn't in the book.
 */
export function partManuscript(data: ReadableBook, partId: number): Manuscript | null {
	const entry = outlineOf(data).find((candidate) => candidate.part.id === partId);
	if (!entry) return null;
	const section = partSection(entry, data, entry.label ? 'part' : 'text');
	return {
		...front(data),
		part: {
			over: section.over,
			title: section.title,
			short: section.short,
			description: section.description,
			// The title can be hidden, but a file still needs something to be called.
			name: section.title || section.over || entry.label || data.book.title
		},
		sections: entry.label ? chapterSections(entry, data) : [section]
	};
}

export const hasStoryText = (manuscript: Manuscript) =>
	manuscript.sections.some((section) => hasContent(section.text, manuscript.pictures));

/** A picture's file, read from the shelf for a file to draw. */
export type PictureFile = {
	bytes: Buffer;
	type: 'jpg' | 'png';
	width: number;
	height: number;
};

/** How many pictures are read from storage at once. */
const READ_AT_ONCE = 4;

/**
 * The files of the pictures set in the text, by their ids on the shelf, read before setting
 * starts. One that can't be read, or isn't a JPEG or a PNG after all, is left out, and the file
 * shows nothing there, as reading mode does for a picture taken off the shelf.
 */
export async function pictureFiles(manuscript: Manuscript) {
	const ids = [
		...new Set(
			manuscript.sections.flatMap((section) =>
				picturesIn(section.text).map((picture) => picture.art)
			)
		)
	].filter((id) => manuscript.pictures[id]);
	const files = new Map<number, PictureFile>();
	for (let from = 0; from < ids.length; from += READ_AT_ONCE) {
		await Promise.all(
			ids.slice(from, from + READ_AT_ONCE).map(async (id) => {
				const source = manuscript.pictures[id];
				const bytes = await readPicture(source.url).catch(() => null);
				if (!bytes) return;
				const type = looksLike('image/png', bytes)
					? 'png'
					: looksLike('image/jpeg', bytes)
						? 'jpg'
						: null;
				if (type) {
					files.set(id, {
						bytes: Buffer.from(bytes),
						type,
						width: source.width,
						height: source.height
					});
				}
			})
		);
	}
	return files;
}

/** How many words of story text it holds. */
export const wordsOf = (manuscript: Manuscript) =>
	manuscript.sections.reduce((words, section) => words + storyWords(section.text), 0);

/** Sections that have a line in the contents. */
export const contentsOf = (manuscript: Manuscript) =>
	manuscript.sections.filter((section) => section.title);

// ---- Formatted text --------------------------------------------------------------------------

export type Family = 'read' | 'display' | 'ui' | 'mono';

/** A stretch of text in one style, with colours resolved for paper. */
export type Run = {
	text: string;
	bold: boolean;
	italic: boolean;
	underline: boolean;
	strike: boolean;
	family: Family;
	/** Size relative to the text around it. */
	scale: number;
	color: string | null;
	highlight: string | null;
	/** Set above the line, as a footnote's number is. */
	raise: boolean;
	/** The footnote this is the number of, counted from 1 in its section (see storyOf). */
	note: number | null;
};

export type Inline = Run | 'break';

/** The light values of --ink-* and --mark-* in tokens.css: a printed page is paper. */
const INKS: Record<string, string> = {
	accent: '#2152d8',
	ruby: '#b3261e',
	ember: '#b4470b',
	gold: '#8a6400',
	moss: '#2a7330',
	teal: '#00756a',
	violet: '#6a3fc0',
	rose: '#b0124f',
	slate: '#5b6385'
};
const MARKS: Record<string, string> = {
	yellow: '#fbeaa0',
	green: '#d3efcc',
	blue: '#d8e4fb',
	pink: '#f9d6e4',
	violet: '#e5daf9'
};

/** A stored colour (a palette variable, a palette id or #rrggbb) as #rrggbb. */
function colourOf(value: unknown, palette: Record<string, string>) {
	if (typeof value !== 'string') return null;
	if (value.startsWith('#')) return value;
	return palette[value.match(/^var\(--\w+-(\w+)\)$/)?.[1] ?? value] ?? null;
}

const FAMILIES: Record<string, Family> = {
	'var(--font-display)': 'display',
	'var(--font-ui)': 'ui',
	'var(--font-mono)': 'mono'
};

export const plainRun = (text: string, style: Partial<Run> = {}): Run => ({
	text,
	bold: false,
	italic: false,
	underline: false,
	strike: false,
	family: 'read',
	scale: 1,
	color: null,
	highlight: null,
	raise: false,
	note: null,
	...style
});

/** How big a footnote's number is against the text it sits in. */
export const NOTE_SCALE = 0.68;

/**
 * A block's text as runs. `base` is the style around it; with `roman`, emphasis in italic text
 * turns upright, as it does in descriptions on the page.
 */
export function runsOf(
	nodes: RichNode[] = [],
	base: Partial<Run> = {},
	{ roman = false }: { roman?: boolean } = {}
): Inline[] {
	const runs: Inline[] = [];
	for (const node of nodes) {
		if (node.type === 'hardBreak') {
			runs.push('break');
			continue;
		}
		// Numbered by storyOf. The number has its own look, whatever is around it.
		if (node.type === 'footnote') {
			const number = Number(node.attrs?.number);
			if (Number.isInteger(number) && number > 0) {
				runs.push(plainRun(String(number), { raise: true, scale: NOTE_SCALE, note: number }));
			}
			continue;
		}
		// Readable text has no mentions left, but its words must never vanish if one gets through.
		const text = node.type === 'mention' ? String(node.attrs?.label ?? '') : (node.text ?? '');
		if (!text) continue;
		const run = plainRun(text, base);
		for (const mark of node.marks ?? []) {
			const attrs = mark.attrs ?? {};
			if (mark.type === 'bold') run.bold = true;
			else if (mark.type === 'italic') run.italic = roman ? !run.italic : true;
			else if (mark.type === 'underline') run.underline = true;
			else if (mark.type === 'strike') run.strike = true;
			else if (mark.type === 'highlight') run.highlight = colourOf(attrs.color, MARKS);
			else if (mark.type === 'textStyle') {
				run.color = colourOf(attrs.color, INKS) ?? run.color;
				if (typeof attrs.fontSize === 'string') run.scale = parseFloat(attrs.fontSize) || 1;
				run.family = FAMILIES[String(attrs.fontFamily)] ?? run.family;
			}
		}
		runs.push(run);
	}
	return runs;
}

/** A footnote's note, a paragraph at a time. Empty paragraphs are left out. */
export function noteParagraphs(value: string): Inline[][] {
	const paragraphs: Inline[][] = [];
	const collect = (nodes: RichNode[]) => {
		for (const node of nodes) {
			if (node.type === 'paragraph' || node.type === 'heading') {
				const runs = runsOf(node.content);
				if (runs.length) paragraphs.push(runs);
			} else if (node.content) collect(node.content);
		}
	};
	collect(parse(value, 'description').content ?? []);
	return paragraphs;
}

/** A footnote's note as one run of text, its paragraphs kept apart by line breaks. */
export const noteInlines = (value: string): Inline[] =>
	noteParagraphs(value).flatMap((runs, index) => (index ? ['break' as const, ...runs] : runs));

/** A description's lines, as it shows under a title: italic, with emphasis turned upright. */
export function descriptionLines(value: string): Inline[][] {
	const lines: Inline[][] = [];
	const collect = (nodes: RichNode[]) => {
		for (const node of nodes) {
			if (node.type === 'paragraph' || node.type === 'heading') {
				const runs = runsOf(node.content, { italic: true }, { roman: true });
				if (runs.length) lines.push(runs);
			} else if (node.content) collect(node.content);
		}
	};
	collect(parse(value, 'description').content ?? []);
	return lines;
}

// ---- The first letter ------------------------------------------------------------------------

export type FirstLetter = Omit<DropCap, 'color'> & {
	color: string;
	/** The letter, with any quotation mark in front of it, as ::first-letter takes it. */
	letter: string;
};

const FIRST_LETTER = /^\s*([\p{P}\p{S}]*[\p{L}\p{N}]\p{M}*)/u;

export type Story = {
	blocks: RichNode[];
	/** The letter to take out of the first paragraph, if it has one. */
	cap: FirstLetter | null;
	/** The footnotes' notes, note 1 first, each a description value. */
	notes: string[];
};

/**
 * The story's blocks, ready to set. Each footnote is given its number (attrs.number), counted in
 * reading order as reading mode counts them, and its note is listed in `notes`.
 */
export function storyOf(text: string): Story {
	const blocks = parse(text, 'story').content ?? [];
	const notes: string[] = [];
	const number = (nodes: RichNode[]) => {
		for (const node of nodes) {
			if (node.type === 'footnote') {
				notes.push(String(node.attrs?.note ?? ''));
				node.attrs = { ...node.attrs, number: notes.length };
			} else if (node.content) number(node.content);
		}
	};
	number(blocks);

	const settings = capOf(text);
	if (settings.style === 'none') return { blocks, cap: null, notes };

	// :first-of-type in prose.css: the first paragraph, even with a heading above it.
	const first = blocks.find((block) => block.type === 'paragraph')?.content?.[0];
	const letter = first?.text?.match(FIRST_LETTER);
	if (!first?.text || !letter) return { blocks, cap: null, notes };

	first.text = first.text.slice(letter[0].length);
	return {
		blocks,
		cap: { ...settings, letter: letter[1], color: colourOf(settings.color, INKS) ?? INKS.accent },
		notes
	};
}
