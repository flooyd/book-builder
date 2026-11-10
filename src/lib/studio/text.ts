// Setting a text shape: its font, its lines and how wide each is, the box they fill, and where a
// caret goes for a point inside it. The canvas measures, so the box is always what's drawn.
//
// Typefaces load on first use. Until one has, the browser measures and draws a stand-in, so when
// it arrives every layout is thrown away and the studio draws again (`onFontsLoaded`). Without a
// canvas at all (a test, the server) widths are estimated.

import { TEXT_FONTS, type TextShape } from '$lib/drawing';

export type TextLine = { text: string; width: number };
export type TextLayout = {
	lines: TextLine[];
	/** The longest line. */
	width: number;
	height: number;
	lineHeight: number;
	/** Added after each letter, in pixels (0 where the browser can't space letters on a canvas). */
	spacing: number;
};

type Settings = Pick<TextShape, 'font' | 'size' | 'bold' | 'italic'>;

/** The CSS font for a text, which the canvas and the stage's typing box both use. */
export function fontOf(shape: Settings) {
	const family = TEXT_FONTS.find((font) => font.key === shape.font)?.family ?? TEXT_FONTS[0].family;
	return `${shape.italic ? 'italic ' : ''}${shape.bold ? 700 : 400} ${shape.size}px ${family}`;
}

let measurer: CanvasRenderingContext2D | null | undefined;
function context() {
	if (measurer === undefined) {
		measurer =
			typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
	}
	return measurer;
}

/** Whether a canvas here can space letters (`letterSpacing`, not yet everywhere). */
export function canSpace(ctx: CanvasRenderingContext2D) {
	return 'letterSpacing' in ctx;
}

/** Sets a canvas up to draw or measure a text. */
export function setFont(ctx: CanvasRenderingContext2D, shape: TextShape) {
	ctx.font = fontOf(shape);
	if (canSpace(ctx)) ctx.letterSpacing = `${shape.tracking * shape.size}px`;
}

// ---- Typefaces arriving ----------------------------------------------------------------------------

let generation = 0;
const requested = new Set<string>();
const listeners = new Set<() => void>();

/** Asks for a typeface the first time it's used; layouts are made again when it arrives. */
function request(font: string) {
	if (requested.has(font) || typeof document === 'undefined' || !document.fonts) return;
	requested.add(font);
	if (document.fonts.check(font)) return;
	document.fonts
		.load(font)
		.then((faces) => {
			if (!faces.length) return;
			generation++;
			for (const listener of listeners) listener();
		})
		.catch(() => {});
}

/** Calls back whenever a typeface arrives that a text was waiting for. Returns a way to stop. */
export function onFontsLoaded(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

// ---- Layout ----------------------------------------------------------------------------------------

const layouts = new WeakMap<TextShape, { generation: number; layout: TextLayout }>();

/** A text's lines and box, in its own coordinates, made once per shape (and typeface arriving). */
export function layoutText(shape: TextShape): TextLayout {
	const cached = layouts.get(shape);
	if (cached && cached.generation === generation) return cached.layout;
	const ctx = context();
	const lineHeight = shape.size * shape.leading;
	let spacing = 0;
	let measure = (text: string) => text.length * shape.size * 0.55;
	if (ctx) {
		const font = fontOf(shape);
		request(font);
		setFont(ctx, shape);
		spacing = canSpace(ctx) ? shape.tracking * shape.size : 0;
		// The canvas adds the spacing after the last letter too; the box stops at the letter.
		measure = (text: string) => (text ? ctx.measureText(text).width - spacing : 0);
	}
	const lines = shape.text.split('\n').map((text) => ({ text, width: Math.max(0, measure(text)) }));
	const longest = Math.max(0, ...lines.map((line) => line.width));
	const layout: TextLayout = {
		lines,
		// An empty text still has a box, to click and to type into.
		width: Math.max(longest, shape.size * 0.25),
		height: lines.length * lineHeight,
		lineHeight,
		spacing
	};
	layouts.set(shape, { generation, layout });
	return layout;
}

/** Where a line starts across its box, for the text's alignment. */
export function lineStart(shape: TextShape, layout: TextLayout, line: TextLine) {
	if (shape.align === 'center') return (layout.width - line.width) / 2;
	if (shape.align === 'right') return layout.width - line.width;
	return 0;
}

/** The place in a text's words nearest a point in its own coordinates, for the caret. */
export function caretAt(shape: TextShape, x: number, y: number) {
	const layout = layoutText(shape);
	const row = Math.max(0, Math.min(layout.lines.length - 1, Math.floor(y / layout.lineHeight)));
	let offset = 0;
	for (let index = 0; index < row; index++) offset += layout.lines[index].text.length + 1;
	const line = layout.lines[row];
	const ctx = context();
	if (!ctx || !line.text) return offset;
	setFont(ctx, shape);
	const across = x - lineStart(shape, layout, line);
	// The nearest gap between letters, by halves of each letter's width.
	const letters = Array.from(line.text);
	let before = 0;
	let length = 0;
	for (const letter of letters) {
		const after =
			ctx.measureText(line.text.slice(0, length + letter.length)).width - layout.spacing;
		if (across < (before + after) / 2) return offset + length;
		before = after;
		length += letter.length;
	}
	return offset + line.text.length;
}
