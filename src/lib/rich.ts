// Rich text: how story text and descriptions are stored, cleaned and shown, on the server and in
// the browser (no DOM needed).
//
// A value is a string: plain text (everything written before the editor, and descriptions without
// formatting), or the editor's document as JSON ('{"type":"doc",…}'). Documents are cleaned
// against an allow-list when saved and again when shown: shared books are public, so nothing but
// known nodes, marks and attribute values may reach a page.

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
 * A footnote's note, cleaned as a description value: plain text, or inline formatting as JSON.
 * Null when there's nothing in it, so a note the writer never wrote isn't kept.
 */
function noteOf(attrs: unknown): string | null {
	const note = (attrs as Record<string, unknown> | undefined)?.note;
	if (typeof note !== 'string' || note.length > MAX_NOTE) return null;
	const clean = serialize(parse(note, 'description'), 'description');
	return clean ? clean : null;
}

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

/** How a node that isn't words reads as text: a mention as something else, a footnote's number. */
type Reading = { mention?: string; footnote?: (node: RichNode) => string };

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
		else if (node.content) blockLines(node.content, out, reading);
	}
	return out;
}

/**
 * The words of the story, a line per paragraph (Insights, word maps, names, search). Footnotes
 * are left out: a note isn't narration, so nothing reads it as the paragraph it hangs from. Count
 * words with `storyWords` in $lib/reading, which adds them back. Given a `mention`, each mention
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
		!(doc.content ?? []).some((node) => node.type === 'horizontalRule') &&
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

/**
 * The words with the footnotes in them, for comparing versions: each number where it sits, and
 * the notes after the story, a line each. An edit inside a note, or a note moved, shows. It's
 * also how to ask whether a text holds anything to read, since `plainText` leaves notes out.
 */
export function textWithNotes(value: string) {
	if (!mayFootnote(value)) return plainText(value);
	const content = parse(value, 'story').content ?? [];
	let count = 0;
	const lines = blockLines(content, [], { footnote: () => superscript(++count) });
	const notes = footnoteNodes(content).map(
		(node, index) =>
			`${superscript(index + 1)} ${plainText(String(node.attrs?.note ?? ''), 'description').replace(/\s*\n\s*/g, ' ')}`
	);
	return [...lines, ...notes].join('\n');
}

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
 * What making a story's HTML keeps track of: the notes met so far, in order, and the id their
 * links are made from, if they have links.
 */
type Page = { notes: string[]; id: string | null };

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
		default:
			return '';
	}
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
 * more than once, as the book view's pages are.
 */
export function toHTML(value: string, kind: RichKind, notes?: string): string {
	const doc = parse(value, kind);
	if (kind === 'story') {
		const page: Page = { notes: [], id: notes && NOTES_ID.test(notes) ? notes : null };
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
