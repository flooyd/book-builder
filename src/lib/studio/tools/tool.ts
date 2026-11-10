// What every studio tool shares: the press it's given, and the marks it draws over the drawing
// (handles, previews, measurements), which the stage's overlay draws in screen pixels.

import type { Point } from '../geometry';

/** A pointer on the stage. */
export type Press = {
	/** Where it is on the drawing, in the drawing's pixels. */
	x: number;
	y: number;
	/** Where it is on the stage, in CSS pixels. */
	sx: number;
	sy: number;
	/** 0 to 1. A mouse reports 1 while pressed. */
	pressure: number;
	tiltX: number;
	tiltY: number;
	pointer: 'mouse' | 'pen' | 'touch';
	shift: boolean;
	alt: boolean;
	/** Ctrl, or Cmd on a Mac. */
	mod: boolean;
	time: number;
};

/** Marks over the drawing, in the stage's CSS pixels. */
export type Chrome = {
	/** Outlines: what's under the pointer, what's selected, what's being drawn. */
	paths: { d: string; kind: 'hover' | 'selected' | 'preview' | 'guide' }[];
	/** A selection's box, with handles to resize and room outside its corners to turn it. */
	box: { corners: Point[]; handles: boolean } | null;
	/** Points of a path being edited. */
	anchors: { x: number; y: number; selected: boolean; first?: boolean }[];
	/** Handles of a path's points: where each is and the point it belongs to. */
	handles: { x: number; y: number; ax: number; ay: number }[];
	marquee: { x: number; y: number; width: number; height: number } | null;
	/** A measurement by the pointer (a size while drawing, an angle while turning). */
	label: { x: number; y: number; text: string } | null;
};

export const noChrome = (): Chrome => ({
	paths: [],
	box: null,
	anchors: [],
	handles: [],
	marquee: null,
	label: null
});

export interface Tool {
	/** The CSS cursor over the stage. */
	readonly cursor: string;
	/** Marks to draw over the drawing. */
	readonly chrome: Chrome;
	down(press: Press): void;
	/** Every move over the stage; `pressed` while a button or pen is down. */
	move(press: Press, pressed: boolean, steps: Press[]): void;
	up(press: Press): void;
	/** A second click in the same place. */
	double?(press: Press): void;
	/** Esc: stop what's under way. Returns whether there was anything to stop. */
	cancel(): boolean;
	/** Enter: finish what's under way. */
	finish?(): boolean;
	/** A key the tool may want before the studio's own (Backspace in the pen). */
	key?(event: KeyboardEvent): boolean;
	/** The tool is being put down: finish or drop what's under way. */
	leave?(): void;
}

// ---- Cursors -----------------------------------------------------------------------------------------

function svgCursor(body: string, x: number, y: number, fallback: string) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${body}</svg>`;
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;
}

/** A double-headed arrow for resizing, at any angle (degrees, 0 pointing right). */
export function resizeCursor(angle: number) {
	const arrow =
		'<path d="M6 16h20M6 16l4-4M6 16l4 4M26 16l-4-4M26 16l-4 4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
	return svgCursor(
		`<g transform="rotate(${angle.toFixed(1)} 16 16)"><g stroke="#fff" stroke-width="4.5">${arrow}</g><g stroke="#111" stroke-width="1.8">${arrow}</g></g>`,
		16,
		16,
		'nwse-resize'
	);
}

/** A curved arrow for turning, facing out from a corner at an angle (degrees). */
export function rotateCursor(angle: number) {
	const arc =
		'<path d="M9 21a9 9 0 0 1 12-12M21 9l-4.5-.6M21 9l-.6 4.5M9 21l.6-4.5M9 21l4.5.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
	return svgCursor(
		`<g transform="rotate(${(angle + 45).toFixed(1)} 16 16)"><g stroke="#fff" stroke-width="4.5">${arc}</g><g stroke="#111" stroke-width="1.8">${arc}</g></g>`,
		16,
		16,
		'grab'
	);
}

const nib =
	'<path d="M5 27l3.2-9.5L18 7.7l6.3 6.3-9.8 9.8z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/><circle cx="13.6" cy="18.4" r="1.6" fill="#111"/>';

/** The pen's cursor, with a sign for what a click would do. */
export function penCursor(sign: '' | '+' | '-' | 'o' | 'x' = '') {
	const marks: Record<string, string> = {
		'': '',
		'+': '<path d="M24 25h6M27 22v6" stroke="#111" stroke-width="1.8"/>',
		'-': '<path d="M24 25h6" stroke="#111" stroke-width="1.8"/>',
		o: '<circle cx="27" cy="25" r="2.6" fill="#fff" stroke="#111" stroke-width="1.6"/>',
		x: '<path d="M24.5 22.5l5 5M29.5 22.5l-5 5" stroke="#111" stroke-width="1.8"/>'
	};
	return svgCursor(nib + marks[sign], 5, 27, 'crosshair');
}

export const pencilCursor = svgCursor(
	'<path d="M4 28l1.6-6.4L21 6.2l4.8 4.8L10.4 26.4z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/><path d="M5.6 21.6l4.8 4.8" stroke="#111" stroke-width="1.6"/>',
	4,
	28,
	'crosshair'
);

/** A fine cross, for drawing shapes. */
export const crossCursor = svgCursor(
	'<g stroke="#fff" stroke-width="4"><path d="M16 4v24M4 16h24"/></g><g stroke="#111" stroke-width="1.4"><path d="M16 4v24M4 16h24"/></g>',
	16,
	16,
	'crosshair'
);

/** The points tool's hollow arrow. */
export const pointsCursor = svgCursor(
	'<path d="M7 4v20l5.5-5.2 3.6 8.2 3.4-1.5-3.6-8h7.5z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>',
	7,
	4,
	'default'
);

/** The select tool's arrow, with a sign for moving a point or a copy. */
export function arrowCursor(sign: '' | 'copy' = '') {
	const copy =
		sign === 'copy'
			? '<path d="M23 24h7M26.5 20.5v7" stroke="#111" stroke-width="1.8"/><path d="M23 24h7M26.5 20.5v7" stroke="#fff" stroke-width="0.6"/>'
			: '';
	return svgCursor(
		`<path d="M7 4v20l5.5-5.2 3.6 8.2 3.4-1.5-3.6-8h7.5z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/>${copy}`,
		7,
		4,
		'default'
	);
}

/** The angle, in degrees, of a line from a to b on screen. */
export const angleOf = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** Snaps the line from a to b to the nearest 45°, keeping its length. */
export function snap45(a: Point, b: Point): Point {
	const angle = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * (Math.PI / 4);
	const length = Math.hypot(b.x - a.x, b.y - a.y);
	return { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length };
}

/** A number for a label: whole, or with one decimal when small. */
export const measure = (value: number) =>
	Math.abs(value) >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
