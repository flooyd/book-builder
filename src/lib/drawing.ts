// A drawing made in the art studio, in Book Builder's own format: a small JSON document of layers,
// vector shapes and paint layers. It's ours rather than a drawing library's, so a drawing never
// depends on one, and it's cleaned against an allow-list on every save, the way story text is:
// nothing but known shapes and checked values is kept.
//
// The document holds no addresses. A paint layer's pixels are stored beside it, by the layer's id,
// so a drawing can't point a reader's browser anywhere.
//
// It imports nothing, so the browser and the server share it and it can be tested alone.

export const DRAWING_VERSION = 1;

// ---- Limits ------------------------------------------------------------------------------------

/** The smallest and largest a drawing may be on a side, in pixels. */
export const MIN_SIDE = 16;
export const MAX_SIDE = 4096;
/** Safari limits one canvas to 16,777,216 pixels (4096 × 4096). */
export const MAX_PIXELS = 4096 * 4096;
export const MAX_LAYERS = 32;
/** Paint layers are canvases, each width × height × 4 bytes, so they're limited by memory too. */
export const MAX_PAINT_LAYERS = 12;
/** All the paint layers of a drawing together, in pixels (about 400 MB of canvas). */
export const PAINT_PIXEL_BUDGET = 100_000_000;
export const MAX_SHAPES = 5000;
export const MAX_ANCHORS = 60_000;
/** Groups inside groups. */
export const MAX_DEPTH = 8;
export const MAX_NAME = 80;
/** Coordinates beyond this, either way, are kept at it. */
const FAR = 100_000;

/** How many paint layers a drawing of this size may have. */
export function paintLayerLimit(width: number, height: number) {
	const room = Math.floor(PAINT_PIXEL_BUDGET / Math.max(1, width * height));
	return Math.max(2, Math.min(MAX_PAINT_LAYERS, room));
}

// ---- The document ------------------------------------------------------------------------------

/** An affine transform [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = [a: number, b: number, c: number, d: number, e: number, f: number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** A colour fill. Gradients will be other kinds beside 'solid'. */
export type Paint = { type: 'solid'; color: string };

export type LineCap = 'butt' | 'round' | 'square';
export type LineJoin = 'miter' | 'round' | 'bevel';
export type Stroke = {
	paint: Paint;
	width: number;
	cap: LineCap;
	join: LineJoin;
	/** Dash and gap lengths, in multiples of the stroke's width; empty is a solid line. */
	dash: number[];
};

/**
 * A point on a path: where it is, its two handles (equal to the point when it has none), and how
 * they move together: 0 a corner (each on its own), 1 smooth (in a line), 2 symmetric (also the
 * same length).
 */
export type Anchor = [
	x: number,
	y: number,
	inX: number,
	inY: number,
	outX: number,
	outY: number,
	kind: 0 | 1 | 2
];
export type Subpath = { closed: boolean; anchors: Anchor[] };

export const BLENDS = [
	'normal',
	'multiply',
	'screen',
	'overlay',
	'darken',
	'lighten',
	'color-dodge',
	'color-burn',
	'hard-light',
	'soft-light',
	'difference',
	'exclusion',
	'hue',
	'saturation',
	'color',
	'luminosity'
] as const;
export type Blend = (typeof BLENDS)[number];

type ShapeBase = {
	id: string;
	name: string;
	/** Places the shape's own coordinates in its layer (or group). */
	transform: Matrix;
	opacity: number;
	hidden: boolean;
	locked: boolean;
};

type Painted = { fill: Paint | null; stroke: Stroke | null };

/** A box from (0, 0) to (width, height) in the shape's own coordinates. */
export type RectShape = ShapeBase &
	Painted & { kind: 'rect'; width: number; height: number; radius: number };
export type EllipseShape = ShapeBase & Painted & { kind: 'ellipse'; width: number; height: number };
/** A regular polygon, stretched to fill its box. */
export type PolygonShape = ShapeBase &
	Painted & { kind: 'polygon'; width: number; height: number; sides: number };
/** A star, stretched to fill its box; `inner` is the inner points' distance, 0 to 1. */
export type StarShape = ShapeBase &
	Painted & { kind: 'star'; width: number; height: number; points: number; inner: number };
export type LineEnd = 'none' | 'arrow';
export type LineShape = ShapeBase & {
	kind: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	stroke: Stroke | null;
	start: LineEnd;
	end: LineEnd;
};
export type PathShape = ShapeBase &
	Painted & { kind: 'path'; paths: Subpath[]; fillRule: 'nonzero' | 'evenodd' };
export type GroupShape = ShapeBase & { kind: 'group'; children: Shape[] };

export type Shape =
	RectShape | EllipseShape | PolygonShape | StarShape | LineShape | PathShape | GroupShape;
export type ShapeKind = Shape['kind'];
/** The shapes with a box (width and height) as their geometry. */
export type BoxShape = RectShape | EllipseShape | PolygonShape | StarShape;

type LayerBase = {
	id: string;
	name: string;
	hidden: boolean;
	locked: boolean;
	opacity: number;
	blend: Blend;
};
export type VectorLayer = LayerBase & { kind: 'vector'; shapes: Shape[] };
/** Pixels, kept beside the document by the layer's id. */
export type PaintLayer = LayerBase & { kind: 'paint' };
export type Layer = VectorLayer | PaintLayer;

export type Drawing = {
	version: typeof DRAWING_VERSION;
	width: number;
	height: number;
	/** The colour under every layer, or null for a clear ground. */
	background: string | null;
	/** Bottom to top. */
	layers: Layer[];
};

// ---- Making things -----------------------------------------------------------------------------

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A short random id for a layer or a shape. */
export function newId() {
	const bytes = new Uint8Array(10);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => ID_CHARS[byte % ID_CHARS.length]).join('');
}

export const solid = (color: string): Paint => ({ type: 'solid', color });

export function newLayer(kind: 'vector' | 'paint', name: string): Layer {
	const base = {
		id: newId(),
		name,
		hidden: false,
		locked: false,
		opacity: 1,
		blend: 'normal' as const
	};
	return kind === 'vector' ? { ...base, kind, shapes: [] } : { ...base, kind };
}

/** A new drawing: a ground and one layer to work on. */
export function newDrawing(
	width: number,
	height: number,
	background: string | null = '#ffffffff'
): Drawing {
	return {
		version: DRAWING_VERSION,
		width: clampSide(width),
		height: clampSide(height),
		background,
		layers: [newLayer('vector', 'Layer 1')]
	};
}

function clampSide(side: number) {
	return Math.max(MIN_SIDE, Math.min(MAX_SIDE, Math.round(side) || MIN_SIDE));
}

/** Sizes to start from, matched to where the picture will go. */
export const PRESETS = [
	{
		key: 'cover',
		label: 'Book cover',
		width: 1800,
		height: 2700,
		hint: 'The PDF’s 6 × 9 inch page'
	},
	{
		key: 'portrait',
		label: 'Portrait',
		width: 1500,
		height: 1500,
		hint: 'Square, for a character'
	},
	{ key: 'map', label: 'Map', width: 2400, height: 1600, hint: 'Wide, for a place' },
	{
		key: 'page',
		label: 'Picture for the page',
		width: 1300,
		height: 975,
		hint: 'As wide as the PDF’s text'
	},
	{
		key: 'ornament',
		label: 'Ornament',
		width: 1200,
		height: 400,
		hint: 'A scene break or a heading'
	}
] as const;

// ---- Colours -----------------------------------------------------------------------------------

const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

/** A colour as #rrggbbaa in lower case, or null if it isn't one. */
export function cleanColor(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const match = HEX.exec(value.trim());
	if (!match) return null;
	return `#${match[1]}${match[2] ?? 'ff'}`.toLowerCase();
}

// ---- Cleaning ----------------------------------------------------------------------------------

type Budget = { shapes: number; anchors: number; ids: Set<string> };

const isObject = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value);

function number(value: unknown, min: number, max: number, fallback: number, places = 2) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	const scale = 10 ** places;
	return Math.round(Math.max(min, Math.min(max, value)) * scale) / scale;
}

const coord = (value: unknown, fallback = 0) => number(value, -FAR, FAR, fallback);
const unit = (value: unknown, fallback: number) => number(value, 0, 1, fallback, 3);

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

// eslint-disable-next-line no-control-regex -- control characters are what's being removed
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** A name, with control characters gone and the length capped. */
export function cleanName(value: unknown, fallback: string) {
	if (typeof value !== 'string') return fallback;
	const name = value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
	return name ? name.slice(0, MAX_NAME) : fallback;
}

/** An id the document hasn't used yet, or a new one. */
function cleanId(value: unknown, budget: Budget) {
	let id = typeof value === 'string' && /^[a-z0-9]{1,24}$/.test(value) ? value : newId();
	while (budget.ids.has(id)) id = newId();
	budget.ids.add(id);
	return id;
}

function cleanMatrix(value: unknown): Matrix {
	if (!Array.isArray(value) || value.length !== 6) return [...IDENTITY];
	const [a, b, c, d, e, f] = value;
	const m: Matrix = [
		number(a, -1000, 1000, 1, 6),
		number(b, -1000, 1000, 0, 6),
		number(c, -1000, 1000, 0, 6),
		number(d, -1000, 1000, 1, 6),
		coord(e),
		coord(f)
	];
	// A transform that squashes a shape flat can't be drawn or turned back.
	return Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-9 ? [...IDENTITY] : m;
}

function cleanPaint(value: unknown): Paint | null {
	if (!isObject(value) || value.type !== 'solid') return null;
	const color = cleanColor(value.color);
	return color ? solid(color) : null;
}

function cleanStroke(value: unknown): Stroke | null {
	if (!isObject(value)) return null;
	const paint = cleanPaint(value.paint);
	if (!paint) return null;
	const dash = Array.isArray(value.dash)
		? value.dash
				.slice(0, 8)
				.map((part) => number(part, 0, 100, 0))
				.filter((part) => part > 0)
		: [];
	return {
		paint,
		width: number(value.width, 0.1, 1000, 1),
		cap: pick(value.cap, ['butt', 'round', 'square'], 'round'),
		join: pick(value.join, ['miter', 'round', 'bevel'], 'round'),
		dash: dash.length % 2 ? [...dash, ...dash] : dash
	};
}

function cleanAnchor(value: unknown): Anchor | null {
	if (!Array.isArray(value) || value.length < 6) return null;
	const x = coord(value[0], NaN);
	const y = coord(value[1], NaN);
	if (Number.isNaN(x) || Number.isNaN(y)) return null;
	const kind = value[6] === 1 || value[6] === 2 ? value[6] : 0;
	return [
		x,
		y,
		coord(value[2], x),
		coord(value[3], y),
		coord(value[4], x),
		coord(value[5], y),
		kind
	];
}

function cleanSubpaths(value: unknown, budget: Budget): Subpath[] {
	if (!Array.isArray(value)) return [];
	const paths: Subpath[] = [];
	for (const item of value) {
		if (!isObject(item) || !Array.isArray(item.anchors)) continue;
		const anchors: Anchor[] = [];
		for (const raw of item.anchors) {
			if (budget.anchors <= 0) break;
			const anchor = cleanAnchor(raw);
			if (!anchor) continue;
			anchors.push(anchor);
			budget.anchors--;
		}
		if (anchors.length) paths.push({ closed: item.closed === true, anchors });
	}
	return paths;
}

function cleanShape(value: unknown, budget: Budget, depth: number): Shape | null {
	if (!isObject(value) || budget.shapes <= 0) return null;
	const kind = value.kind;
	const base: ShapeBase = {
		id: cleanId(value.id, budget),
		name: cleanName(value.name, ''),
		transform: cleanMatrix(value.transform),
		opacity: unit(value.opacity, 1),
		hidden: value.hidden === true,
		locked: value.locked === true
	};
	const painted: Painted = { fill: cleanPaint(value.fill), stroke: cleanStroke(value.stroke) };
	const side = (key: string) => number(value[key], 0.01, FAR, 1);
	budget.shapes--;
	switch (kind) {
		case 'rect':
			return {
				...base,
				...painted,
				kind,
				width: side('width'),
				height: side('height'),
				radius: number(value.radius, 0, FAR, 0)
			};
		case 'ellipse':
			return { ...base, ...painted, kind, width: side('width'), height: side('height') };
		case 'polygon':
			return {
				...base,
				...painted,
				kind,
				width: side('width'),
				height: side('height'),
				sides: Math.round(number(value.sides, 3, 64, 6))
			};
		case 'star':
			return {
				...base,
				...painted,
				kind,
				width: side('width'),
				height: side('height'),
				points: Math.round(number(value.points, 3, 64, 5)),
				inner: number(value.inner, 0.05, 1, 0.45, 3)
			};
		case 'line':
			return {
				...base,
				kind,
				x1: coord(value.x1),
				y1: coord(value.y1),
				x2: coord(value.x2),
				y2: coord(value.y2),
				stroke: painted.stroke,
				start: pick(value.start, ['none', 'arrow'], 'none'),
				end: pick(value.end, ['none', 'arrow'], 'none')
			};
		case 'path': {
			const paths = cleanSubpaths(value.paths, budget);
			if (!paths.length) return null;
			return {
				...base,
				...painted,
				kind,
				paths,
				fillRule: pick(value.fillRule, ['nonzero', 'evenodd'], 'nonzero')
			};
		}
		case 'group': {
			if (depth >= MAX_DEPTH || !Array.isArray(value.children)) return null;
			const children = cleanShapes(value.children, budget, depth + 1);
			return children.length ? { ...base, kind, children } : null;
		}
		default:
			budget.shapes++;
			return null;
	}
}

function cleanShapes(value: unknown, budget: Budget, depth: number): Shape[] {
	if (!Array.isArray(value)) return [];
	const shapes: Shape[] = [];
	for (const item of value) {
		const shape = cleanShape(item, budget, depth);
		if (shape) shapes.push(shape);
	}
	return shapes;
}

function cleanLayer(value: unknown, budget: Budget, paintRoom: { left: number }): Layer | null {
	if (!isObject(value)) return null;
	if (value.kind !== 'vector' && value.kind !== 'paint') return null;
	if (value.kind === 'paint' && paintRoom.left <= 0) return null;
	const base: LayerBase = {
		id: cleanId(value.id, budget),
		name: cleanName(value.name, value.kind === 'paint' ? 'Paint' : 'Layer'),
		hidden: value.hidden === true,
		locked: value.locked === true,
		opacity: unit(value.opacity, 1),
		blend: pick(value.blend, BLENDS, 'normal')
	};
	if (value.kind === 'paint') {
		paintRoom.left--;
		return { ...base, kind: 'paint' };
	}
	return { ...base, kind: 'vector', shapes: cleanShapes(value.shapes, budget, 0) };
}

/**
 * A drawing with nothing but known layers, shapes and values, or null if it isn't one at all.
 * Run on the server on every save, and on anything read back from storage.
 */
export function cleanDrawing(value: unknown): Drawing | null {
	if (!isObject(value) || value.version !== DRAWING_VERSION) return null;
	if (typeof value.width !== 'number' || typeof value.height !== 'number') return null;
	let width = clampSide(value.width);
	let height = clampSide(value.height);
	if (width * height > MAX_PIXELS) {
		const shrink = Math.sqrt(MAX_PIXELS / (width * height));
		width = Math.floor(width * shrink);
		height = Math.floor(height * shrink);
	}
	const budget: Budget = { shapes: MAX_SHAPES, anchors: MAX_ANCHORS, ids: new Set() };
	const paintRoom = { left: paintLayerLimit(width, height) };
	const layers: Layer[] = [];
	if (Array.isArray(value.layers)) {
		for (const item of value.layers) {
			if (layers.length >= MAX_LAYERS) break;
			const layer = cleanLayer(item, budget, paintRoom);
			if (layer) layers.push(layer);
		}
	}
	if (!layers.length) layers.push(newLayer('vector', 'Layer 1'));
	return {
		version: DRAWING_VERSION,
		width,
		height,
		background: value.background === null ? null : (cleanColor(value.background) ?? '#ffffffff'),
		layers
	};
}

/** A drawing from stored JSON, cleaned; null if it can't be read. */
export function parseDrawing(json: string): Drawing | null {
	try {
		return cleanDrawing(JSON.parse(json));
	} catch {
		return null;
	}
}

// ---- Reading a drawing -------------------------------------------------------------------------

/** Every shape in a list, groups' children included, depth first. */
export function* allShapes(shapes: Shape[]): Generator<Shape> {
	for (const shape of shapes) {
		yield shape;
		if (shape.kind === 'group') yield* allShapes(shape.children);
	}
}

export function shapeCount(drawing: Drawing) {
	let count = 0;
	for (const layer of drawing.layers) {
		if (layer.kind === 'vector') count += [...allShapes(layer.shapes)].length;
	}
	return count;
}

/** What a shape is called in a list when it has no name of its own. */
export function kindLabel(shape: Shape) {
	switch (shape.kind) {
		case 'rect':
			return shape.radius > 0 ? 'Rounded rectangle' : 'Rectangle';
		case 'ellipse':
			return shape.width === shape.height ? 'Circle' : 'Ellipse';
		case 'polygon':
			return shape.sides === 3 ? 'Triangle' : 'Polygon';
		case 'star':
			return 'Star';
		case 'line':
			return shape.end === 'arrow' || shape.start === 'arrow' ? 'Arrow' : 'Line';
		case 'path':
			return 'Path';
		case 'group':
			return 'Group';
	}
}
