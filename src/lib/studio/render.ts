// Drawing a drawing on a canvas: on screen at any zoom, and at full size when it's saved or
// downloaded. Both go through drawScene, so what's saved is what was seen.
//
// Vector layers are drawn from their shapes every time, so they're sharp at any zoom. Paint layers
// are canvases of the drawing's size. A layer's opacity and blend mode apply to the layer as a
// whole (shapes overlapping inside a half-clear layer don't show through each other), so such a
// layer is drawn on a scratch canvas first and then laid on the rest.
//
// Browser only.

import {
	IDENTITY,
	type Drawing,
	type LineShape,
	type Matrix,
	type Shape,
	type Stroke
} from '$lib/drawing';
import { multiply, outline, pathData } from './geometry';

export type View = { x: number; y: number; zoom: number };

/** A stroke being painted, not yet laid onto its layer. */
export type LiveStroke = {
	layerId: string;
	canvas: CanvasImageSource;
	opacity: number;
	erase: boolean;
};

export type Scene = {
	doc: Drawing;
	paint: Map<string, HTMLCanvasElement>;
	live?: LiveStroke | null;
	/** A shape being drawn, shown on its layer before it's part of the drawing. */
	sketch?: { layerId: string; shape: Shape } | null;
};

type Context = CanvasRenderingContext2D;

// ---- Shapes ----------------------------------------------------------------------------------------

const paths = new WeakMap<Shape, Path2D>();

/** A shape's outline as a Path2D in its own coordinates, made once per shape. */
export function pathOf(shape: Shape): Path2D {
	let path = paths.get(shape);
	if (!path) {
		path = new Path2D(pathData(outline(shape)));
		paths.set(shape, path);
	}
	return path;
}

function applyStroke(ctx: Context, stroke: Stroke) {
	ctx.strokeStyle = stroke.paint.color;
	ctx.lineWidth = stroke.width;
	ctx.lineCap = stroke.cap;
	ctx.lineJoin = stroke.join;
	ctx.miterLimit = 10;
	ctx.setLineDash(stroke.dash.map((part) => part * stroke.width));
}

/** An arrowhead's size for a stroke width: long enough to read, never a spike. */
function arrowSize(width: number) {
	return { length: width * 3.2 + 6, half: width * 1.9 + 3.5 };
}

/** A line, shortened where it meets an arrowhead, and its heads. */
export function lineParts(shape: LineShape) {
	const width = shape.stroke?.width ?? 1;
	const { length, half } = arrowSize(width);
	const dx = shape.x2 - shape.x1;
	const dy = shape.y2 - shape.y1;
	const span = Math.hypot(dx, dy) || 1;
	const ux = dx / span;
	const uy = dy / span;
	const heads: [number, number][][] = [];
	let { x1, y1, x2, y2 } = shape;
	const head = (tipX: number, tipY: number, dirX: number, dirY: number) => {
		const baseX = tipX - dirX * length;
		const baseY = tipY - dirY * length;
		heads.push([
			[tipX, tipY],
			[baseX - dirY * half, baseY + dirX * half],
			[baseX + dirY * half, baseY - dirX * half]
		]);
		return [tipX - dirX * length * 0.7, tipY - dirY * length * 0.7];
	};
	if (shape.end === 'arrow' && span > length * 0.5) [x2, y2] = head(shape.x2, shape.y2, ux, uy);
	if (shape.start === 'arrow' && span > length * 0.5) [x1, y1] = head(shape.x1, shape.y1, -ux, -uy);
	return { x1, y1, x2, y2, heads };
}

function drawLine(ctx: Context, shape: LineShape) {
	if (!shape.stroke) return;
	applyStroke(ctx, shape.stroke);
	const { x1, y1, x2, y2, heads } = lineParts(shape);
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = shape.stroke.paint.color;
	for (const [tip, left, right] of heads) {
		ctx.beginPath();
		ctx.moveTo(...tip);
		ctx.lineTo(...left);
		ctx.lineTo(...right);
		ctx.closePath();
		ctx.fill();
	}
}

/** Draws shapes through m (their parent's place on the canvas), each with its own transform. */
export function drawShapes(ctx: Context, shapes: Shape[], m: Matrix, alpha = 1) {
	for (const shape of shapes) {
		if (shape.hidden) continue;
		const placed = multiply(m, shape.transform);
		const opacity = alpha * shape.opacity;
		if (opacity <= 0) continue;
		if (shape.kind === 'group') {
			drawShapes(ctx, shape.children, placed, opacity);
			continue;
		}
		ctx.setTransform(...placed);
		ctx.globalAlpha = opacity;
		if (shape.kind === 'line') {
			drawLine(ctx, shape);
			continue;
		}
		const path = pathOf(shape);
		if (shape.fill) {
			ctx.fillStyle = shape.fill.color;
			ctx.fill(path, shape.kind === 'path' ? shape.fillRule : 'nonzero');
		}
		if (shape.stroke) {
			applyStroke(ctx, shape.stroke);
			ctx.stroke(path);
		}
	}
	ctx.globalAlpha = 1;
	ctx.setLineDash([]);
}

// ---- The whole drawing ----------------------------------------------------------------------------

export type SceneOptions = {
	/** Drawing pixels to canvas pixels. */
	base: Matrix;
	/** A canvas the same size as the target, for layers that are blended or see-through. */
	scratch: () => Context;
	/** The checkerboard that shows a clear ground, or null to leave it clear. */
	checker?: CanvasPattern | null;
	/** Paint layers drawn without smoothing (close up, to see the pixels). */
	pixelated?: boolean;
};

/** Draws the drawing's ground and layers onto a cleared canvas, clipped to the artboard. */
export function drawScene(ctx: Context, scene: Scene, options: SceneOptions) {
	const { doc, paint } = scene;
	const { base } = options;
	const left = base[4];
	const top = base[5];
	const width = doc.width * base[0];
	const height = doc.height * base[3];

	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.beginPath();
	ctx.rect(left, top, width, height);
	ctx.clip();
	if (options.checker && (!doc.background || !doc.background.endsWith('ff'))) {
		ctx.fillStyle = options.checker;
		ctx.fillRect(left, top, width, height);
	}
	if (doc.background) {
		ctx.fillStyle = doc.background;
		ctx.fillRect(left, top, width, height);
	}

	const smooth = !options.pixelated;
	// A shape being drawn goes on its layer, or on top when its layer is still to be made.
	const sketchHome = doc.layers.some(
		(layer) => layer.id === scene.sketch?.layerId && layer.kind === 'vector' && !layer.hidden
	);
	for (const layer of doc.layers) {
		if (layer.hidden || layer.opacity <= 0) continue;
		const live = scene.live?.layerId === layer.id ? scene.live : null;
		const sketch = scene.sketch?.layerId === layer.id ? scene.sketch.shape : null;
		const plain = layer.opacity >= 1 && layer.blend === 'normal';

		if (layer.kind === 'paint') {
			const pixels = paint.get(layer.id);
			if (!pixels) continue;
			if (!live) {
				ctx.setTransform(...base);
				ctx.globalAlpha = layer.opacity;
				ctx.globalCompositeOperation = layer.blend === 'normal' ? 'source-over' : layer.blend;
				ctx.imageSmoothingEnabled = smooth;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(pixels, 0, 0);
				ctx.globalAlpha = 1;
				ctx.globalCompositeOperation = 'source-over';
				continue;
			}
			// The layer with the stroke on it, then that laid on the rest as one.
			const scratch = options.scratch();
			scratch.setTransform(...base);
			scratch.imageSmoothingEnabled = smooth;
			scratch.imageSmoothingQuality = 'high';
			scratch.drawImage(pixels, 0, 0);
			scratch.globalAlpha = live.opacity;
			scratch.globalCompositeOperation = live.erase ? 'destination-out' : 'source-over';
			scratch.drawImage(live.canvas, 0, 0);
			scratch.globalAlpha = 1;
			scratch.globalCompositeOperation = 'source-over';
			layOn(ctx, scratch, layer.opacity, layer.blend);
			continue;
		}

		if (plain) {
			drawShapes(ctx, layer.shapes, base);
			if (sketch) drawShapes(ctx, [sketch], base);
			continue;
		}
		const scratch = options.scratch();
		drawShapes(scratch, layer.shapes, base);
		if (sketch) drawShapes(scratch, [sketch], base);
		layOn(ctx, scratch, layer.opacity, layer.blend);
	}
	if (scene.sketch && !sketchHome) drawShapes(ctx, [scene.sketch.shape], base);
	ctx.restore();
}

function layOn(ctx: Context, scratch: Context, opacity: number, blend: string) {
	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalAlpha = opacity;
	ctx.globalCompositeOperation =
		blend === 'normal' ? 'source-over' : (blend as GlobalCompositeOperation);
	ctx.drawImage(scratch.canvas, 0, 0);
	ctx.restore();
}

function canvasOf(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(width));
	canvas.height = Math.max(1, Math.round(height));
	return canvas;
}

/** A scratch canvas the size of another, cleared each time it's asked for. */
function scratchFor(target: HTMLCanvasElement) {
	let scratch: Context | null = null;
	return () => {
		if (
			!scratch ||
			scratch.canvas.width !== target.width ||
			scratch.canvas.height !== target.height
		) {
			scratch = canvasOf(target.width, target.height).getContext('2d')!;
		}
		scratch.setTransform(1, 0, 0, 1, 0, 0);
		scratch.globalAlpha = 1;
		scratch.globalCompositeOperation = 'source-over';
		scratch.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height);
		return scratch;
	};
}

/** The whole drawing on a canvas of its own, at a scale (1 is full size). */
export function flatten(scene: Scene, scale = 1): HTMLCanvasElement {
	const canvas = canvasOf(scene.doc.width * scale, scene.doc.height * scale);
	const ctx = canvas.getContext('2d')!;
	const base: Matrix = [
		canvas.width / scene.doc.width,
		0,
		0,
		canvas.height / scene.doc.height,
		0,
		0
	];
	drawScene(ctx, scene, { base, scratch: scratchFor(canvas) });
	return canvas;
}

/** A small picture of the drawing, at most `side` pixels on its longer side. */
export function thumbnail(scene: Scene, side = 360) {
	const scale = Math.min(1, side / Math.max(scene.doc.width, scene.doc.height));
	return flatten(scene, scale);
}

// ---- On screen -----------------------------------------------------------------------------------

/** Draws a scene on the stage's canvas, at the view's zoom and scroll, sharp at the screen's density. */
export class Renderer {
	readonly canvas: HTMLCanvasElement;
	readonly #ctx: Context;
	readonly #scratch: () => Context;
	#checker: CanvasPattern | null = null;
	#density = 1;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.#ctx = canvas.getContext('2d')!;
		this.#scratch = scratchFor(canvas);
	}

	/** Matches the canvas to its box on the page (in CSS pixels) and the screen's density. */
	resize(width: number, height: number, density: number) {
		this.#density = density;
		const pixelWidth = Math.max(1, Math.round(width * density));
		const pixelHeight = Math.max(1, Math.round(height * density));
		if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
			this.canvas.width = pixelWidth;
			this.canvas.height = pixelHeight;
		}
	}

	#checkerPattern() {
		if (this.#checker) return this.#checker;
		const cell = Math.round(8 * this.#density);
		const tile = canvasOf(cell * 2, cell * 2);
		const ctx = tile.getContext('2d')!;
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, cell * 2, cell * 2);
		ctx.fillStyle = '#e3e3e3';
		ctx.fillRect(0, 0, cell, cell);
		ctx.fillRect(cell, cell, cell, cell);
		this.#checker = this.#ctx.createPattern(tile, 'repeat');
		return this.#checker;
	}

	draw(scene: Scene, view: View, shadow: string) {
		const ctx = this.#ctx;
		const density = this.#density;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		const base: Matrix = [
			view.zoom * density,
			0,
			0,
			view.zoom * density,
			view.x * density,
			view.y * density
		];
		// The artboard's shadow, under everything.
		ctx.save();
		ctx.shadowColor = shadow;
		ctx.shadowBlur = 28 * density;
		ctx.shadowOffsetY = 10 * density;
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(base[4], base[5], scene.doc.width * base[0], scene.doc.height * base[3]);
		ctx.restore();
		drawScene(ctx, scene, {
			base,
			scratch: this.#scratch,
			checker: this.#checkerPattern(),
			pixelated: view.zoom >= 2
		});
	}
}

// ---- Finding what's under a point ------------------------------------------------------------------

let probe: Context | null = null;
function probeContext() {
	probe ??= canvasOf(1, 1).getContext('2d')!;
	return probe;
}

/**
 * Whether a point (in the parent's coordinates of m) is on a shape: inside its fill, or within
 * `slack` of its stroke or outline. Returns the deepest shape hit, for a group.
 */
export function hitShape(
	shape: Shape,
	m: Matrix,
	x: number,
	y: number,
	slack: number
): Shape | null {
	if (shape.hidden) return null;
	const placed = multiply(m, shape.transform);
	if (shape.kind === 'group') {
		for (let index = shape.children.length - 1; index >= 0; index--) {
			const hit = hitShape(shape.children[index], placed, x, y, slack);
			if (hit) return hit;
		}
		return null;
	}
	const ctx = probeContext();
	ctx.setTransform(...placed);
	if (shape.kind === 'line') {
		const { x1, y1, x2, y2 } = shape;
		const path = new Path2D(`M${x1} ${y1}L${x2} ${y2}`);
		ctx.lineWidth =
			Math.max(shape.stroke?.width ?? 1, slack * 2) +
			(shape.end !== 'none' || shape.start !== 'none' ? 6 : 0);
		ctx.lineCap = 'round';
		return ctx.isPointInStroke(path, x, y) ? shape : null;
	}
	const path = pathOf(shape);
	if (
		shape.fill &&
		ctx.isPointInPath(path, x, y, shape.kind === 'path' ? shape.fillRule : 'nonzero')
	) {
		return shape;
	}
	ctx.lineWidth = Math.max(shape.stroke?.width ?? 0, slack * 2);
	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';
	return ctx.isPointInStroke(path, x, y) ? shape : null;
}

/**
 * The shape under a point on the drawing: the topmost on the topmost layer that's shown and not
 * locked. `deep` finds the shape itself inside a group rather than the group.
 */
export function shapeAt(
	doc: Drawing,
	x: number,
	y: number,
	slack: number,
	deep = false
): Shape | null {
	for (let layerIndex = doc.layers.length - 1; layerIndex >= 0; layerIndex--) {
		const layer = doc.layers[layerIndex];
		if (layer.kind !== 'vector' || layer.hidden || layer.locked) continue;
		for (let index = layer.shapes.length - 1; index >= 0; index--) {
			const shape = layer.shapes[index];
			if (shape.locked) continue;
			const hit = hitShape(shape, IDENTITY, x, y, slack);
			if (hit) return deep ? hit : shape;
		}
	}
	return null;
}
