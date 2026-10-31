// Rich text: how story text and descriptions are stored, cleaned and shown, on the server and in
// the browser (no DOM needed).
//
// A value is a string: plain text (everything written before the editor, and descriptions without
// formatting), or the editor's document as JSON ('{"type":"doc",…}'). Documents are cleaned
// against an allow-list when saved and again when shown: shared books are public, so nothing but
// known nodes, marks and attribute values may reach a page.

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

function cleanInline(nodes: unknown): RichNode[] {
	if (!Array.isArray(nodes)) return [];
	const clean: RichNode[] = [];
	for (const node of nodes) {
		if (node?.type === 'text' && typeof node.text === 'string' && node.text) {
			const marks = cleanMarks(node.marks);
			clean.push(
				marks ? { type: 'text', text: node.text, marks } : { type: 'text', text: node.text }
			);
		} else if (node?.type === 'hardBreak') {
			clean.push({ type: 'hardBreak' });
		}
	}
	return clean;
}

function alignOf(attrs: unknown) {
	const align = (attrs as Record<string, unknown> | undefined)?.textAlign;
	return typeof align === 'string' && ALIGNS.includes(align) ? { textAlign: align } : undefined;
}

function cleanBlocks(nodes: unknown, depth: number): RichNode[] {
	if (!Array.isArray(nodes) || depth > MAX_DEPTH) return [];
	const clean: RichNode[] = [];
	for (const node of nodes) {
		const type = node?.type;
		if (type === 'paragraph') {
			const attrs = alignOf(node.attrs);
			clean.push({ type, ...(attrs && { attrs }), content: cleanInline(node.content) });
		} else if (type === 'heading') {
			const level = node.attrs?.level;
			clean.push({
				type,
				attrs: { level: level === 2 || level === 3 ? level : 1, ...alignOf(node.attrs) },
				content: cleanInline(node.content)
			});
		} else if (type === 'blockquote' || type === 'listItem') {
			clean.push({ type, content: cleanBlocks(node.content, depth + 1) });
		} else if (type === 'bulletList' || type === 'orderedList') {
			const items = cleanBlocks(node.content, depth + 1).filter((n) => n.type === 'listItem');
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
		content: cleanBlocks(source?.content, 0)
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

function textOf(node: RichNode): string {
	if (node.type === 'text') return node.text ?? '';
	if (node.type === 'hardBreak') return '\n';
	return (node.content ?? []).map(textOf).join('');
}

const BLOCK_TYPES = new Set(['paragraph', 'heading']);

function blockLines(nodes: RichNode[], out: string[]) {
	for (const node of nodes) {
		if (BLOCK_TYPES.has(node.type)) out.push(textOf(node));
		else if (node.content) blockLines(node.content, out);
	}
	return out;
}

/** The words alone, a line per paragraph (word counts, search, plain-text export). */
export function plainText(value: string, kind: RichKind = 'story') {
	return isRich(value) ? blockLines(parse(value, kind).content ?? [], []).join('\n') : value;
}

function isEmpty(doc: RichDoc) {
	return (
		!(doc.content ?? []).some((node) => node.type === 'horizontalRule') &&
		blockLines(doc.content ?? [], []).every((line) => !line.trim())
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

function inlineHTML(nodes: RichNode[] = []) {
	return nodes.map((node) => (node.type === 'hardBreak' ? '<br>' : textHTML(node))).join('');
}

const alignAttr = (node: RichNode) =>
	node.attrs?.textAlign ? ` style="text-align: ${node.attrs.textAlign}"` : '';

function blockHTML(node: RichNode): string {
	switch (node.type) {
		case 'paragraph': {
			const inner = inlineHTML(node.content);
			// An empty paragraph is a blank line the writer left on purpose.
			return `<p${alignAttr(node)}>${inner || '<br>'}</p>`;
		}
		case 'heading': {
			// Chapter titles are h2/h3 in reading mode, so headings in the text start at h4.
			const tag = `h${Number(node.attrs?.level ?? 1) + 3}`;
			return `<${tag}${alignAttr(node)}>${inlineHTML(node.content)}</${tag}>`;
		}
		case 'blockquote':
			return `<blockquote>${(node.content ?? []).map(blockHTML).join('')}</blockquote>`;
		case 'bulletList':
			return `<ul>${(node.content ?? []).map(blockHTML).join('')}</ul>`;
		case 'orderedList': {
			const start = node.attrs?.start ? ` start="${Number(node.attrs.start)}"` : '';
			return `<ol${start}>${(node.content ?? []).map(blockHTML).join('')}</ol>`;
		}
		case 'listItem':
			return `<li>${(node.content ?? []).map(blockHTML).join('')}</li>`;
		case 'horizontalRule':
			return '<hr>';
		default:
			return '';
	}
}

/**
 * Safe HTML for a value. Story text becomes blocks; a description becomes inline text, its
 * paragraphs joined by line breaks (it sits inside a <p> or <span>).
 */
export function toHTML(value: string, kind: RichKind) {
	const doc = parse(value, kind);
	if (kind === 'story') return (doc.content ?? []).map(blockHTML).join('');
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
