// Rich text: how story text and descriptions are stored, cleaned and shown, on the server and in
// the browser (no DOM needed).
//
// A value is a string: plain text (everything written before the editor, and descriptions without
// formatting), or the editor's document as JSON ('{"type":"doc",…}'). Documents are cleaned
// against an allow-list when saved and again when shown: shared books are public, so nothing but
// known nodes, marks and attribute values may reach a page.

import { DESCRIPTION_LIMIT, SMALL_SIDE } from '$lib/art';
import { isEntryType, type EntryType } from '$lib/bible';

export type RichMark = { type: string; attrs?: Record<string, unknown> };
export type RichNode = {
	type: string;
	attrs?: Record<string, unknown>;
	content?: RichNode[];
	text?: string;
	marks?: RichMark[];
};
export type RichDoc = RichNode & { type: 'doc' };

/** Story text (blocks, scene breaks, first letter) or a description (formatted inline text). */
export type RichKind = 'story' | 'description';

// ---- Choices offered by the editor (and the only values allowed) ---------------------------

/** Text colours: theme-aware tokens (--ink-*), readable on paper and at night. */
export const INKS = [
	{ id: 'accent', label: 'Accent' },
	{ id: 'ruby', label: 'Ruby' },
	{ id: 'ember', label: 'Ember' },
	{ id: 'gold', label: 'Gold' },
	{ id: 'moss', label: 'Moss' },
	{ id: 'teal', label: 'Teal' },
	{ id: 'violet', label: 'Violet' },
	{ id: 'rose', label: 'Rose' },
	{ id: 'slate', label: 'Slate' }
] as const;

/** Highlighter colours (--mark-*). */
export const HIGHLIGHTS = [
	{ id: 'yellow', label: 'Yellow' },
	{ id: 'green', label: 'Green' },
	{ id: 'blue', label: 'Blue' },
	{ id: 'pink', label: 'Pink' },
	{ id: 'violet', label: 'Violet' }
] as const;

export const inkVar = (id: string) => `var(--ink-${id})`;
export const highlightVar = (id: string) => `var(--mark-${id})`;

/** Sizes relative to the text around them, so the reader's text size still scales them. */
export const SIZES = [
	{ value: '0.75em', label: 'Tiny' },
	{ value: '0.875em', label: 'Small' },
	{ value: '', label: 'Normal' },
	{ value: '1.25em', label: 'Large' },
	{ value: '1.5em', label: 'Larger' },
	{ value: '2em', label: 'Huge' }
] as const;

/** Typefaces; '' is the book's own (the reader's serif or sans setting). */
export const FONTS = [
	{ value: '', label: 'Book' },
	{ value: 'var(--font-display)', label: 'Display' },
	{ value: 'var(--font-ui)', label: 'Sans' },
	{ value: 'var(--font-mono)', label: 'Typewriter' }
] as const;

const HEX = /^#[0-9a-f]{6}$/i;
const ALIGNS = ['left', 'center', 'right', 'justify'];

const validInk = (value: unknown): value is string =>
	typeof value === 'string' && (HEX.test(value) || INKS.some((ink) => inkVar(ink.id) === value));
const validHighlight = (value: unknown): value is string =>
	typeof value === 'string' &&
	(HEX.test(value) || HIGHLIGHTS.some((mark) => highlightVar(mark.id) === value));
const validSize = (value: unknown): value is string =>
	typeof value === 'string' && SIZES.some((size) => size.value && size.value === value);
const validFont = (value: unknown): value is string =>
	typeof value === 'string' && FONTS.some((font) => font.value && font.value === value);

// ---- The first letter of a chapter -----------------------------------------------------------

export type DropCap = {
	/** drop: sunk into the first lines · raised: tall on the first line · boxed: in a block */
	style: 'drop' | 'raised' | 'boxed' | 'none';
	/** How many lines a drop or boxed letter spans. */
	lines: 2 | 3 | 4;
	font: 'display' | 'read' | 'ui';
	/** An INKS id or a #rrggbb colour. */
	color: string;
};

export const DEFAULT_CAP: DropCap = { style: 'drop', lines: 2, font: 'display', color: 'accent' };

export const CAP_STYLES = [
	{ id: 'drop', label: 'Drop' },
	{ id: 'raised', label: 'Raised' },
	{ id: 'boxed', label: 'Boxed' },
	{ id: 'none', label: 'None' }
] as const;
export const CAP_FONTS = [
	{ id: 'display', label: 'Display', css: 'var(--font-display)' },
	{ id: 'read', label: 'Book', css: 'var(--font-read)' },
	{ id: 'ui', label: 'Sans', css: 'var(--font-ui)' }
] as const;

export function cleanCap(value: unknown): DropCap | null {
	if (!value || typeof value !== 'object') return null;
	const cap = value as Record<string, unknown>;
	return {
		style: CAP_STYLES.some((s) => s.id === cap.style) ? (cap.style as DropCap['style']) : 'drop',
		lines: cap.lines === 3 || cap.lines === 4 ? cap.lines : 2,
		font: CAP_FONTS.some((f) => f.id === cap.font) ? (cap.font as DropCap['font']) : 'display',
		color:
			typeof cap.color === 'string' &&
			(HEX.test(cap.color) || INKS.some((ink) => ink.id === cap.color))
				? cap.color
				: 'accent'
	};
}

/** Class and inline style for a story's first letter (see .cap-* in prose.css). */
export function capPresentation(cap: DropCap) {
	const color = HEX.test(cap.color) ? cap.color : inkVar(cap.color);
	const font = CAP_FONTS.find((f) => f.id === cap.font)?.css ?? 'var(--font-display)';
	return {
		class: `cap-${cap.style}`,
		style: `--cap-lines: ${cap.lines}; --cap-font: ${font}; --cap-color: ${color}`
	};
}

// ---- Parsing and cleaning --------------------------------------------------------------------

export const isRich = (value: string) => value.startsWith('{"type":"doc"');

/** A line of nothing but *, #, ~, -, • or ⁂ (e.g. "* * *") marks a scene break in plain text. */
const SCENE_BREAK = /^([*#~•⁂-]\s*)+$/;

const MAX_DEPTH = 12;

function cleanMarks(marks: unknown): RichMark[] | undefined {
	if (!Array.isArray(marks)) return undefined;
	const clean: RichMark[] = [];
	for (const mark of marks) {
		const type = mark?.type;
		const attrs = mark?.attrs ?? {};
		if (type === 'bold' || type === 'italic' || type === 'underline' || type === 'strike') {
			clean.push({ type });
		} else if (type === 'highlight' && validHighlight(attrs.color)) {
			clean.push({ type, attrs: { color: attrs.color } });
		} else if (type === 'textStyle') {
			const style: Record<string, string> = {};
			if (validInk(attrs.color)) style.color = attrs.color;
			if (validSize(attrs.fontSize)) style.fontSize = attrs.fontSize;
			if (validFont(attrs.fontFamily)) style.fontFamily = attrs.fontFamily;
			if (Object.keys(style).length) clean.push({ type, attrs: style });
		}
	}
	return clean.length ? clean : undefined;
}

/** A mention's own attributes, or null if they aren't a mention's. */
function mentionAttrs(attrs: unknown): Mention | null {
	const source = attrs as Record<string, unknown> | undefined;
	const id = Number(source?.id);
	const label = typeof source?.label === 'string' ? source.label.trim().slice(0, 200) : '';
	if (!isEntryType(source?.entry) || !Number.isSafeInteger(id) || id <= 0 || !label) return null;
	return { entry: source.entry, id, label };
}

const textNode = (text: string, marks?: RichMark[]): RichNode =>
	marks ? { type: 'text', text, marks } : { type: 'text', text };

/** Longer than any note: a request with one this long isn't a writer's. */
const MAX_NOTE = 100_000;

/**
 * A description value held in an attribute (a footnote's note, a picture's caption): plain text,
 * or inline formatting as JSON. Null when there's nothing in it.
 */
function descriptionAttr(value: unknown): string | null {
	if (typeof value !== 'string' || value.length > MAX_NOTE) return null;
	const clean = serialize(parse(value, 'description'), 'description');
	return clean ? clean : null;
}

/** A footnote's note. Null when it's empty, so a note the writer never wrote isn't kept. */
const noteOf = (attrs: unknown) =>
	descriptionAttr((attrs as Record<string, unknown> | undefined)?.note);

function cleanInline(nodes: unknown, kind: RichKind): RichNode[] {
	if (!Array.isArray(nodes)) return [];
	const clean: RichNode[] = [];
	for (const node of nodes) {
		if (node?.type === 'text' && typeof node.text === 'string' && node.text) {
			clean.push(textNode(node.text, cleanMarks(node.marks)));
		} else if (node?.type === 'hardBreak') {
			clean.push({ type: 'hardBreak' });
		} else if (node?.type === 'mention') {
			const mention = mentionAttrs(node.attrs);
			const marks = cleanMarks(node.marks);
			if (!mention) continue;
			// Descriptions have no mentions: keep the word and let the link go.
			if (kind === 'description') clean.push(textNode(mention.label, marks));
			else clean.push({ type: 'mention', attrs: mention, ...(marks && { marks }) });
		} else if (node?.type === 'footnote' && kind === 'story') {
			// Story text only. A description has nowhere to put a note, and a note is a description,
			// so there are no notes inside notes. The number takes no marks: it has its own style.
			const note = noteOf(node.attrs);
			if (note) clean.push({ type: 'footnote', attrs: { note } });
		}
	}
	return clean;
}

function alignOf(attrs: unknown) {
	const align = (attrs as Record<string, unknown> | undefined)?.textAlign;
	return typeof align === 'string' && ALIGNS.includes(align) ? { textAlign: align } : undefined;
}

function cleanBlocks(nodes: unknown, depth: number, kind: RichKind): RichNode[] {
	if (!Array.isArray(nodes) || depth > MAX_DEPTH) return [];
	const clean: RichNode[] = [];
	for (const node of nodes) {
		const type = node?.type;
		if (type === 'paragraph') {
			const attrs = alignOf(node.attrs);
			clean.push({ type, ...(attrs && { attrs }), content: cleanInline(node.content, kind) });
		} else if (type === 'heading') {
			const level = node.attrs?.level;
			clean.push({
				type,
				attrs: { level: level === 2 || level === 3 ? level : 1, ...alignOf(node.attrs) },
				content: cleanInline(node.content, kind)
			});
		} else if (type === 'blockquote' || type === 'listItem') {
			clean.push({ type, content: cleanBlocks(node.content, depth + 1, kind) });
		} else if (type === 'bulletList' || type === 'orderedList') {
			const items = cleanBlocks(node.content, depth + 1, kind).filter((n) => n.type === 'listItem');
			const start = Number(node.attrs?.start);
			clean.push({
				type,
				...(type === 'orderedList' &&
					Number.isInteger(start) &&
					start > 1 &&
					start < 100000 && { attrs: { start } }),
				content: items
			});
		} else if (type === 'horizontalRule') {
			clean.push({ type });
		} else if (type === 'picture' && kind === 'story' && depth === 0) {
			// Between blocks of the story only: never in a quote or a list, never in a description.
			const picture = pictureAttrs(node.attrs);
			if (picture) clean.push({ type, attrs: picture });
		}
	}
	return clean;
}

/** Only known nodes, marks and attribute values; anything else is dropped. */
export function cleanDoc(doc: unknown, kind: RichKind): RichDoc {
	const source = doc as RichNode | null;
	const cap = kind === 'story' ? cleanCap(source?.attrs?.dropCap) : null;
	return {
		type: 'doc',
		...(cap && { attrs: { dropCap: cap } }),
		content: cleanBlocks(source?.content, 0, kind)
	};
}

/** A stored value as a document: rich values parsed and cleaned, plain text a paragraph a line. */
export function parse(value: string, kind: RichKind): RichDoc {
	if (isRich(value)) {
		try {
			return cleanDoc(JSON.parse(value), kind);
		} catch {
			// not JSON after all: treat it as plain text
		}
	}
	const content: RichNode[] = [];
	for (const raw of value.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		if (kind === 'story' && SCENE_BREAK.test(line)) {
			if (content.length && content[content.length - 1].type !== 'horizontalRule') {
				content.push({ type: 'horizontalRule' });
			}
		} else {
			content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
		}
	}
	if (content[content.length - 1]?.type === 'horizontalRule') content.pop();
	return { type: 'doc', content };
}

/** Clean a value from a request before storing it. Plain text is kept as it is. */
export function cleanValue(value: string, kind: RichKind): string {
	if (!isRich(value)) return value;
	const doc = parse(value, kind);
	return isEmpty(doc) && !doc.attrs ? '' : JSON.stringify(doc);
}

// ---- Plain text ------------------------------------------------------------------------------

/**
 * How a node that isn't words reads as text: a mention as something else, a footnote's number, a
 * picture as a line of its own (left out without one).
 */
type Reading = {
	mention?: string;
	footnote?: (node: RichNode) => string;
	picture?: (node: RichNode) => string;
};

function textOf(node: RichNode, reading: Reading = {}): string {
	if (node.type === 'text') return node.text ?? '';
	if (node.type === 'mention') return reading.mention ?? String(node.attrs?.label ?? '');
	if (node.type === 'hardBreak') return '\n';
	// The number isn't a word, and the note isn't part of the sentence it hangs from.
	if (node.type === 'footnote') return reading.footnote?.(node) ?? '';
	return (node.content ?? []).map((child) => textOf(child, reading)).join('');
}

const BLOCK_TYPES = new Set(['paragraph', 'heading']);

function blockLines(nodes: RichNode[], out: string[], reading: Reading = {}) {
	for (const node of nodes) {
		if (BLOCK_TYPES.has(node.type)) out.push(textOf(node, reading));
		else if (node.type === 'picture' && reading.picture) out.push(reading.picture(node));
		else if (node.content) blockLines(node.content, out, reading);
	}
	return out;
}

/**
 * The words of the story, a line per paragraph (Insights, word maps, names, search). Footnotes
 * and pictures' captions are left out: they aren't narration, so nothing reads them as the story.
 * Count words with `storyWords` in $lib/reading, which adds them back. Given a `mention`, each mention
 * reads as that instead of its words: looking for names in what's left mustn't find a mention a
 * second time.
 */
export function plainText(value: string, kind: RichKind = 'story', mention?: string) {
	return isRich(value)
		? blockLines(parse(value, kind).content ?? [], [], { mention }).join('\n')
		: value;
}

function isEmpty(doc: RichDoc) {
	return (
		!(doc.content ?? []).some(
			(node) => node.type === 'horizontalRule' || node.type === 'picture'
		) &&
		blockLines(doc.content ?? [], []).every((line) => !line.trim()) &&
		footnoteNodes(doc.content ?? []).length === 0
	);
}

/** Only paragraphs of unformatted text: storable as plain text. */
function isPlain(doc: RichDoc) {
	return (doc.content ?? []).every(
		(node) =>
			node.type === 'paragraph' &&
			!node.attrs &&
			(node.content ?? []).every((child) => child.type === 'text' && !child.marks)
	);
}

/**
 * The editor's document as stored: '' when there is nothing in it, and a description with no
 * formatting as plain text. Everything else as cleaned JSON.
 */
export function serialize(doc: unknown, kind: RichKind): string {
	const clean = cleanDoc(doc, kind);
	if (isEmpty(clean) && !clean.attrs) return '';
	if (kind === 'description' && isPlain(clean)) {
		return blockLines(clean.content ?? [], [])
			.map((line) => line.trim())
			.filter(Boolean)
			.join('\n');
	}
	return JSON.stringify(clean);
}

// ---- Mentions --------------------------------------------------------------------------------

/**
 * A link from story text to a story bible entry. `label` is the words on the page, which may be a
 * short name rather than the entry's own ("Juno" for Juno Halley).
 */
export type Mention = { entry: EntryType; id: number; label: string };

/** Quick test before parsing: most story text has no mentions at all. */
const mayMention = (value: string) => isRich(value) && value.includes('"type":"mention"');

/** Visit every mention node, last first, so a visitor can replace it in its siblings. */
function eachMention(
	nodes: RichNode[],
	visit: (node: RichNode, index: number, siblings: RichNode[]) => void
) {
	for (let index = nodes.length - 1; index >= 0; index--) {
		const node = nodes[index];
		if (node.type === 'mention') visit(node, index, nodes);
		else if (node.content) eachMention(node.content, visit);
	}
}

/** Every mention in a stored story value, in no particular order. */
export function mentionsIn(value: string): Mention[] {
	if (!mayMention(value)) return [];
	const found: Mention[] = [];
	eachMention(parse(value, 'story').content ?? [], (node) => {
		const mention = mentionAttrs(node.attrs);
		if (mention) found.push(mention);
	});
	return found;
}

/** Neighbouring text with the same marks is one run: the editor expects that of a document. */
function joinText(nodes: RichNode[]): RichNode[] {
	const joined: RichNode[] = [];
	for (const node of nodes) {
		const last = joined[joined.length - 1];
		if (
			last?.type === 'text' &&
			node.type === 'text' &&
			JSON.stringify(last.marks) === JSON.stringify(node.marks)
		) {
			last.text = `${last.text ?? ''}${node.text ?? ''}`;
		} else {
			joined.push(node.content ? { ...node, content: joinText(node.content) } : { ...node });
		}
	}
	return joined;
}

/**
 * A stored story value with its mentions changed: `change` returns the mention as it should be,
 * or null to let the link go and leave the words as plain text. Unchanged text comes back as it
 * was, so a caller can compare.
 */
export function mapMentions(value: string, change: (mention: Mention) => Mention | null) {
	if (!mayMention(value)) return value;
	const doc = parse(value, 'story');
	let changed = false;
	eachMention(doc.content ?? [], (node, index, siblings) => {
		const mention = mentionAttrs(node.attrs);
		if (!mention) return;
		const next = change(mention);
		if (!next) {
			siblings[index] = textNode(mention.label, node.marks);
			changed = true;
		} else if (next.label !== mention.label) {
			node.attrs = next;
			changed = true;
		}
	});
	return changed ? JSON.stringify({ ...doc, content: joinText(doc.content ?? []) }) : value;
}

/** The value with every mention turned back into plain words, for anything readers receive. */
export const withoutMentions = (value: string) => mapMentions(value, () => null);

// ---- Footnotes -------------------------------------------------------------------------------
//
// A footnote is an inline atom in story text that carries its own note:
// {"type":"footnote","attrs":{"note":"…"}}, where the note is a description value. Numbers are
// never stored: a note's number is its place among the notes of its text (one chapter, or one
// part), counted wherever it's drawn, so moving a paragraph renumbers them.

/** Quick test before parsing: most story text has no footnotes. */
const mayFootnote = (value: string) => isRich(value) && value.includes('"type":"footnote"');

/** Every footnote node, in the order they're read. */
function footnoteNodes(nodes: RichNode[], out: RichNode[] = []) {
	for (const node of nodes) {
		if (node.type === 'footnote') out.push(node);
		else if (node.content) footnoteNodes(node.content, out);
	}
	return out;
}

/** The notes of a story value, in order: note 1 first. Each is a description value. */
export function footnotesIn(value: string): string[] {
	if (!mayFootnote(value)) return [];
	return footnoteNodes(parse(value, 'story').content ?? []).map((node) =>
		String(node.attrs?.note ?? '')
	);
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const superscript = (number: number) =>
	[...String(number)].map((digit) => SUPERSCRIPT[Number(digit)]).join('');

/** A description value as one line of words. */
const oneLine = (value: string) => plainText(value, 'description').replace(/\s*\n\s*/g, ' ');

/** The words, with each footnote's number where it sits and the notes after, a line each. */
function wordsAndNotes(value: string, reading: Reading = {}) {
	if (!mayFootnote(value) && !(reading.picture && mayPicture(value))) return plainText(value);
	const content = parse(value, 'story').content ?? [];
	let count = 0;
	const lines = blockLines(content, [], { ...reading, footnote: () => superscript(++count) });
	const notes = footnoteNodes(content).map(
		(node, index) => `${superscript(index + 1)} ${oneLine(String(node.attrs?.note ?? ''))}`
	);
	return [...lines, ...notes].join('\n');
}

/**
 * The words with the footnotes and pictures in them, for comparing versions: each number where
 * it sits, the notes after the story, a line each, and a line for each picture, with its caption.
 * An edit inside a note, or a picture added, taken out or moved, shows.
 */
export const textWithNotes = (value: string) =>
	wordsAndNotes(value, {
		picture: (node) => {
			const caption = oneLine(String(node.attrs?.caption ?? '')).trim();
			const alt = String(node.attrs?.alt ?? '').trim();
			return `[Picture${caption || alt ? `: ${caption || alt}` : ''}]`;
		}
	});

/**
 * Whether a story value holds anything to read: words, a note or a picture. Given `pictures`, a
 * picture counts only if it's there to show (one taken off the shelf isn't).
 */
export function hasContent(value: string, pictures?: PictureSources) {
	if (wordsAndNotes(value).trim()) return true;
	return picturesIn(value).some((picture) => !pictures || pictures[picture.art]);
}

// ---- Pictures --------------------------------------------------------------------------------
//
// A picture from the writer's art shelf, a block of its own between the story's other blocks
// (idea 22): {"type":"picture","attrs":{"art":12,"width":1800,"height":1200,"size":"wide",
// "alt":"…","decorative":false,"caption":"…"}}. The caption is a description value. The document
// holds the picture's id on the shelf and never an address: whatever shows it looks the id up in
// `PictureSources`, which only the server fills, so no document can make a reader's browser load
// anything from anywhere else.

export const PICTURE_SIZES = [
	{ id: 'wide', label: 'Wide', hint: 'As wide as the text' },
	{ id: 'small', label: 'Small', hint: 'Smaller, in the middle' },
	{ id: 'page', label: 'Own page', hint: 'A page to itself in the book and the PDF' }
] as const;
export type PictureSize = (typeof PICTURE_SIZES)[number]['id'];

export type Picture = {
	/** Its id on the art shelf. */
	art: number;
	width: number;
	height: number;
	size: PictureSize;
	/** What it shows, for someone who can't see it. */
	alt: string;
	/** Only decoration: a screen reader passes over it. */
	decorative: boolean;
	/** A description value, or ''. */
	caption: string;
};

/** Where a picture's files are, by its id on the shelf: what the server tells a page. */
export type PictureSource = { url: string; smallUrl: string; width: number; height: number };
export type PictureSources = Record<number, PictureSource>;

/** Bigger than any picture the shelf keeps (LONG_SIDE). */
const MAX_SIDE = 20_000;

const isSide = (value: number) => Number.isInteger(value) && value > 0 && value <= MAX_SIDE;

/** A picture's own attributes, or null if they aren't a picture's. */
function pictureAttrs(attrs: unknown): Picture | null {
	const source = attrs as Record<string, unknown> | undefined;
	const art = Number(source?.art);
	const width = Number(source?.width);
	const height = Number(source?.height);
	if (!Number.isSafeInteger(art) || art <= 0 || !isSide(width) || !isSide(height)) return null;
	const size = PICTURE_SIZES.find((choice) => choice.id === source?.size)?.id ?? 'wide';
	const alt =
		typeof source?.alt === 'string'
			? source.alt.replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_LIMIT)
			: '';
	return {
		art,
		width,
		height,
		size,
		alt,
		decorative: source?.decorative === true,
		caption: descriptionAttr(source?.caption) ?? ''
	};
}

/** Quick test before parsing: most story text has no pictures. */
const mayPicture = (value: string) => isRich(value) && value.includes('"type":"picture"');

/** The pictures of a story value, in the order they're read. */
export function picturesIn(value: string): Picture[] {
	if (!mayPicture(value)) return [];
	return (parse(value, 'story').content ?? [])
		.filter((node) => node.type === 'picture')
		.map((node) => pictureAttrs(node.attrs))
		.filter((picture): picture is Picture => picture !== null);
}

/**
 * A stored story value with its pictures changed: `change` returns the picture as it should be,
 * or null to take it out. Unchanged text comes back as it was, so a caller can compare.
 */
export function mapPictures(value: string, change: (picture: Picture) => Picture | null) {
	if (!mayPicture(value)) return value;
	const doc = parse(value, 'story');
	let changed = false;
	const content: RichNode[] = [];
	for (const node of doc.content ?? []) {
		const picture = node.type === 'picture' ? pictureAttrs(node.attrs) : null;
		if (!picture) {
			content.push(node);
			continue;
		}
		const next = change(picture);
		if (JSON.stringify(next) !== JSON.stringify(picture)) changed = true;
		if (next) content.push({ type: 'picture', attrs: next });
	}
	if (!changed) return value;
	const next = { ...doc, content };
	return isEmpty(next) && !next.attrs ? '' : JSON.stringify(next);
}

/**
 * The two files a browser may choose between for a picture, by how wide it's drawn: the small
 * copy (at most SMALL_SIDE a side) on a phone, the whole picture on a large or sharp screen.
 * No `srcset` when the small copy is the whole picture.
 */
export function pictureSizes(source: PictureSource, size: PictureSize) {
	const small = Math.max(
		1,
		Math.round(source.width * Math.min(1, SMALL_SIDE / Math.max(source.width, source.height)))
	);
	return {
		srcset:
			small < source.width ? `${source.smallUrl} ${small}w, ${source.url} ${source.width}w` : '',
		sizes: size === 'small' ? '(max-width: 640px) 70vw, 440px' : '(max-width: 720px) 100vw, 720px'
	};
}

/** An address the server handed out for a file on the shelf: our own, or https. */
const isFileAddress = (url: unknown): url is string =>
	typeof url === 'string' &&
	(/^\/api\/art\/local\/[\w./-]+$/.test(url) || /^https:\/\/[\w.-]+\/[\w./%-]+$/.test(url));

// ---- HTML ------------------------------------------------------------------------------------

const escape = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

function textHTML(node: RichNode) {
	let html = escape(node.text ?? '');
	// Innermost first; textStyle and highlight wrap the simple marks.
	const marks = [...(node.marks ?? [])].reverse();
	for (const mark of marks) {
		const attrs = mark.attrs ?? {};
		if (mark.type === 'bold') html = `<strong>${html}</strong>`;
		else if (mark.type === 'italic') html = `<em>${html}</em>`;
		else if (mark.type === 'underline') html = `<u>${html}</u>`;
		else if (mark.type === 'strike') html = `<s>${html}</s>`;
		else if (mark.type === 'highlight' && validHighlight(attrs.color)) {
			html = `<mark style="background-color: ${attrs.color}">${html}</mark>`;
		} else if (mark.type === 'textStyle') {
			const style = [
				validInk(attrs.color) && `color: ${attrs.color}`,
				validSize(attrs.fontSize) && `font-size: ${attrs.fontSize}`,
				validFont(attrs.fontFamily) && `font-family: ${attrs.fontFamily}`
			].filter(Boolean);
			if (style.length) html = `<span style="${style.join('; ')}">${html}</span>`;
		}
	}
	return html;
}

/**
 * What making a story's HTML keeps track of: the notes met so far, in order, the id their links
 * are made from, if they have links, and where the pictures are.
 */
type Page = { notes: string[]; id: string | null; pictures: PictureSources };

/** A footnote's number in the line, a link to its note when the note has an id to link to. */
function footnoteHTML(node: RichNode, page: Page) {
	page.notes.push(String(node.attrs?.note ?? ''));
	const number = page.notes.length;
	if (!page.id) return `<sup class="bb-fn-ref" data-note="${number}">${number}</sup>`;
	return (
		`<sup class="bb-fn-ref" id="${page.id}-ref-${number}" data-note="${number}">` +
		`<a href="#${page.id}-note-${number}" aria-label="Note ${number}">${number}</a></sup>`
	);
}

/** Reading mode shows a mention as the plain words it is: only the writer sees it as a link. */
function inlineNodeHTML(node: RichNode, page?: Page) {
	if (node.type === 'hardBreak') return '<br>';
	if (node.type === 'mention') {
		return textHTML({ type: 'text', text: String(node.attrs?.label ?? ''), marks: node.marks });
	}
	if (node.type === 'footnote') return page ? footnoteHTML(node, page) : '';
	return textHTML(node);
}

function inlineHTML(nodes: RichNode[] = [], page?: Page) {
	return nodes.map((node) => inlineNodeHTML(node, page)).join('');
}

const alignAttr = (node: RichNode) =>
	node.attrs?.textAlign ? ` style="text-align: ${node.attrs.textAlign}"` : '';

function blockHTML(node: RichNode, page: Page): string {
	const children = () => (node.content ?? []).map((child) => blockHTML(child, page)).join('');
	switch (node.type) {
		case 'paragraph': {
			const inner = inlineHTML(node.content, page);
			// An empty paragraph is a blank line the writer left on purpose.
			return `<p${alignAttr(node)}>${inner || '<br>'}</p>`;
		}
		case 'heading': {
			// Chapter titles are h2/h3 in reading mode, so headings in the text start at h4.
			const tag = `h${Number(node.attrs?.level ?? 1) + 3}`;
			return `<${tag}${alignAttr(node)}>${inlineHTML(node.content, page)}</${tag}>`;
		}
		case 'blockquote':
			return `<blockquote>${children()}</blockquote>`;
		case 'bulletList':
			return `<ul>${children()}</ul>`;
		case 'orderedList': {
			const start = node.attrs?.start ? ` start="${Number(node.attrs.start)}"` : '';
			return `<ol${start}>${children()}</ol>`;
		}
		case 'listItem':
			return `<li>${children()}</li>`;
		case 'horizontalRule':
			return '<hr>';
		case 'picture': {
			const picture = pictureAttrs(node.attrs);
			return picture ? pictureHTML(picture, page.pictures[picture.art]) : '';
		}
		default:
			return '';
	}
}

/**
 * A picture, if it's still on the shelf (nothing at all if it isn't). Its box has its shape from
 * the start (`--ratio`), so nothing moves as the file arrives: the book view counts its pages
 * before then. The editor draws its pictures with this too.
 */
export function pictureHTML(picture: Picture, source: PictureSource | undefined) {
	if (
		!source ||
		!isFileAddress(source.url) ||
		!isFileAddress(source.smallUrl) ||
		!isSide(source.width) ||
		!isSide(source.height)
	) {
		return '';
	}
	const ratio = (source.width / source.height).toFixed(4);
	const { srcset, sizes } = pictureSizes(source, picture.size);
	const choices = srcset ? ` srcset="${escape(srcset)}" sizes="${sizes}"` : '';
	const alt = picture.decorative ? '' : escape(picture.alt);
	const caption = picture.caption
		? `<figcaption>${toHTML(picture.caption, 'description')}</figcaption>`
		: '';
	return (
		`<figure class="bb-picture bb-picture-${picture.size}" style="--ratio: ${ratio}">` +
		`<img src="${escape(source.url)}"${choices} width="${source.width}" height="${source.height}" alt="${alt}" decoding="async">` +
		`${caption}</figure>`
	);
}

/** The notes, after the story they belong to, each with a link back to its number. */
function notesHTML(page: Page): string {
	if (!page.notes.length) return '';
	const items = page.notes.map((note, index): string => {
		const number = index + 1;
		const id = page.id ? ` id="${page.id}-note-${number}"` : '';
		const back = page.id
			? ` <a class="bb-note-back" href="#${page.id}-ref-${number}" aria-label="Back to note ${number} in the text">↩︎</a>`
			: '';
		return (
			`<li${id} data-note="${number}"><span class="bb-note-number">${number}</span>` +
			`<span class="bb-note-text">${toHTML(note, 'description')}</span>${back}</li>`
		);
	});
	return `<aside class="bb-notes" aria-label="Notes"><ol>${items.join('')}</ol></aside>`;
}

/** An id can only be made from letters, digits and dashes ("chapter-12"). */
const NOTES_ID = /^[a-z][\w-]{0,60}$/i;

/**
 * Safe HTML for a value. Story text becomes blocks, with its footnotes listed after them; a
 * description becomes inline text, its paragraphs joined by line breaks (it sits inside a <p> or
 * <span>). Give story text `notes`, an id no other text on the page has (the section's key), and
 * each footnote's number links to its note and back. Leave it out where the same text is drawn
 * more than once, as the book view's pages are. A picture shows only if `pictures` says where it
 * is.
 */
export function toHTML(
	value: string,
	kind: RichKind,
	notes?: string,
	pictures: PictureSources = {}
): string {
	const doc = parse(value, kind);
	if (kind === 'story') {
		const page: Page = {
			notes: [],
			id: notes && NOTES_ID.test(notes) ? notes : null,
			pictures
		};
		const blocks = (doc.content ?? []).map((node) => blockHTML(node, page)).join('');
		return blocks + notesHTML(page);
	}
	const lines: string[] = [];
	const collect = (nodes: RichNode[]) => {
		for (const node of nodes) {
			if (BLOCK_TYPES.has(node.type)) lines.push(inlineHTML(node.content));
			else if (node.content) collect(node.content);
		}
	};
	collect(doc.content ?? []);
	return lines.filter(Boolean).join('<br>');
}

/** The first-letter settings of a story value (the default for plain text). */
export function capOf(value: string): DropCap {
	if (!isRich(value)) return DEFAULT_CAP;
	return cleanCap(parse(value, 'story').attrs?.dropCap) ?? DEFAULT_CAP;
}
