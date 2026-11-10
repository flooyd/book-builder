// The art studio's geometry: transforms, Bézier curves, the outline of each kind of shape, and
// bounds. No DOM, so it can be tested alone (a text's box is then estimated: see text.ts).
// Coordinates are a drawing's pixels, y downwards.

import {
	IDENTITY,
	type Anchor,
	type BoxShape,
	type Matrix,
	type Shape,
	type Subpath
} from '$lib/drawing';
import { layoutText } from './text';

export type Point = { x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const EPSILON = 1e-9;

// ---- Transforms ----------------------------------------------------------------------------------

/** m·n: what n does, then what m does. */
export function multiply(m: Matrix, n: Matrix): Matrix {
	const [a1, b1, c1, d1, e1, f1] = m;
	const [a2, b2, c2, d2, e2, f2] = n;
	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1
	];
}

export function invert(m: Matrix): Matrix | null {
	const [a, b, c, d, e, f] = m;
	const det = a * d - b * c;
	if (Math.abs(det) < EPSILON) return null;
	return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

export function apply(m: Matrix, x: number, y: number): Point {
	return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

export const translation = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

/** Scaling about a point. */
export function scaling(sx: number, sy: number, ox = 0, oy = 0): Matrix {
	return [sx, 0, 0, sy, ox - sx * ox, oy - sy * oy];
}

/** Turning by an angle in radians (clockwise on screen, since y runs down) about a point. */
export function rotation(angle: number, ox = 0, oy = 0): Matrix {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return [cos, sin, -sin, cos, ox - cos * ox + sin * oy, oy - sin * ox - cos * oy];
}

/**
 * A transform as a move, a turn, a scale and a shear: m = move · turn · [scaleX shear; 0 scaleY].
 * scaleX is never negative; a mirror image shows as a negative scaleY.
 */
export type Parts = {
	x: number;
	y: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
	shear: number;
};

export function decompose(m: Matrix): Parts {
	const [a, b, c, d, e, f] = m;
	const scaleX = Math.hypot(a, b);
	if (scaleX < EPSILON) return { x: e, y: f, rotation: 0, scaleX: 0, scaleY: d, shear: c };
	const cos = a / scaleX;
	const sin = b / scaleX;
	return {
		x: e,
		y: f,
		rotation: Math.atan2(b, a),
		scaleX,
		scaleY: -sin * c + cos * d,
		shear: cos * c + sin * d
	};
}

export function compose(parts: Parts): Matrix {
	const cos = Math.cos(parts.rotation);
	const sin = Math.sin(parts.rotation);
	const { scaleX, scaleY, shear } = parts;
	return [
		cos * scaleX,
		sin * scaleX,
		cos * shear - sin * scaleY,
		sin * shear + cos * scaleY,
		parts.x,
		parts.y
	];
}

/** Whether two transforms do the same thing, near enough. */
export function sameMatrix(m: Matrix, n: Matrix) {
	return m.every((value, index) => Math.abs(value - n[index]) < 1e-6);
}

// ---- Bounds ----------------------------------------------------------------------------------------

export const emptyBounds = (): Bounds => ({
	minX: Infinity,
	minY: Infinity,
	maxX: -Infinity,
	maxY: -Infinity
});

export const isEmpty = (bounds: Bounds) => bounds.minX > bounds.maxX;

export function addPoint(bounds: Bounds, x: number, y: number) {
	if (x < bounds.minX) bounds.minX = x;
	if (y < bounds.minY) bounds.minY = y;
	if (x > bounds.maxX) bounds.maxX = x;
	if (y > bounds.maxY) bounds.maxY = y;
}

export function union(a: Bounds | null, b: Bounds | null): Bounds | null {
	if (!a) return b;
	if (!b) return a;
	return {
		minX: Math.min(a.minX, b.minX),
		minY: Math.min(a.minY, b.minY),
		maxX: Math.max(a.maxX, b.maxX),
		maxY: Math.max(a.maxY, b.maxY)
	};
}

export const boundsWidth = (bounds: Bounds) => bounds.maxX - bounds.minX;
export const boundsHeight = (bounds: Bounds) => bounds.maxY - bounds.minY;

/** The four corners of a box, clockwise from the top left, through a transform. */
export function corners(bounds: Bounds, m: Matrix = IDENTITY): Point[] {
	return [
		apply(m, bounds.minX, bounds.minY),
		apply(m, bounds.maxX, bounds.minY),
		apply(m, bounds.maxX, bounds.maxY),
		apply(m, bounds.minX, bounds.maxY)
	];
}

export function intersects(a: Bounds, b: Bounds) {
	return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

export function contains(outer: Bounds, inner: Bounds) {
	return (
		inner.minX >= outer.minX &&
		inner.maxX <= outer.maxX &&
		inner.minY >= outer.minY &&
		inner.maxY <= outer.maxY
	);
}

// ---- Curves ------------------------------------------------------------------------------------------

/** One coordinate of a cubic Bézier at t. */
export function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number) {
	const u = 1 - t;
	return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** Where one coordinate of a cubic turns back, strictly inside (0, 1). */
function turningPoints(p0: number, p1: number, p2: number, p3: number) {
	// The derivative over 3 is a·t² + b·t + c.
	const a = -p0 + 3 * p1 - 3 * p2 + p3;
	const b = 2 * (p0 - 2 * p1 + p2);
	const c = p1 - p0;
	const found: number[] = [];
	if (Math.abs(a) < EPSILON) {
		if (Math.abs(b) > EPSILON) found.push(-c / b);
	} else {
		const disc = b * b - 4 * a * c;
		if (disc >= 0) {
			const root = Math.sqrt(disc);
			found.push((-b + root) / (2 * a), (-b - root) / (2 * a));
		}
	}
	return found.filter((t) => t > 0 && t < 1);
}

/** Widens bounds to take in a cubic segment, exactly. */
export function addSegment(
	bounds: Bounds,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x3: number,
	y3: number
) {
	addPoint(bounds, x0, y0);
	addPoint(bounds, x3, y3);
	for (const t of turningPoints(x0, x1, x2, x3))
		addPoint(bounds, cubicAt(x0, x1, x2, x3, t), cubicAt(y0, y1, y2, y3, t));
	for (const t of turningPoints(y0, y1, y2, y3))
		addPoint(bounds, cubicAt(x0, x1, x2, x3, t), cubicAt(y0, y1, y2, y3, t));
}

/** A segment of a subpath: from one anchor to the next, through their handles. */
export type Segment = [
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	x3: number,
	y3: number
];

export function* segments(path: Subpath): Generator<Segment> {
	const { anchors } = path;
	const count = path.closed ? anchors.length : anchors.length - 1;
	for (let index = 0; index < count; index++) {
		const from = anchors[index];
		const to = anchors[(index + 1) % anchors.length];
		yield [from[0], from[1], from[4], from[5], to[2], to[3], to[0], to[1]];
	}
}

/** Whether a segment is a straight line (its handles sit on its ends). */
export const isStraight = (segment: Segment) =>
	segment[2] === segment[0] &&
	segment[3] === segment[1] &&
	segment[4] === segment[6] &&
	segment[5] === segment[7];

export function subpathBounds(paths: Subpath[], m: Matrix = IDENTITY): Bounds | null {
	const bounds = emptyBounds();
	for (const path of transformSubpaths(paths, m)) {
		if (path.anchors.length === 1) addPoint(bounds, path.anchors[0][0], path.anchors[0][1]);
		for (const segment of segments(path)) addSegment(bounds, ...segment);
	}
	return isEmpty(bounds) ? null : bounds;
}

/** Splits a cubic at t (de Casteljau): the two halves' points. */
export function splitSegment(segment: Segment, t: number): [Segment, Segment] {
	const [x0, y0, x1, y1, x2, y2, x3, y3] = segment;
	const lerp = (a: number, b: number) => a + (b - a) * t;
	const ax = lerp(x0, x1),
		ay = lerp(y0, y1);
	const bx = lerp(x1, x2),
		by = lerp(y1, y2);
	const cx = lerp(x2, x3),
		cy = lerp(y2, y3);
	const dx = lerp(ax, bx),
		dy = lerp(ay, by);
	const ex = lerp(bx, cx),
		ey = lerp(by, cy);
	const fx = lerp(dx, ex),
		fy = lerp(dy, ey);
	return [
		[x0, y0, ax, ay, dx, dy, fx, fy],
		[fx, fy, ex, ey, cx, cy, x3, y3]
	];
}

/** The nearest point on a segment to p: its t, where it is, and how far. */
export function nearestOnSegment(segment: Segment, px: number, py: number) {
	const [x0, y0, x1, y1, x2, y2, x3, y3] = segment;
	const at = (t: number) => ({ x: cubicAt(x0, x1, x2, x3, t), y: cubicAt(y0, y1, y2, y3, t) });
	const distance = (t: number) => {
		const point = at(t);
		return Math.hypot(point.x - px, point.y - py);
	};
	// Coarse samples, then narrow in around the best.
	const steps = 32;
	let best = 0;
	let bestDistance = Infinity;
	for (let step = 0; step <= steps; step++) {
		const d = distance(step / steps);
		if (d < bestDistance) {
			bestDistance = d;
			best = step / steps;
		}
	}
	let low = Math.max(0, best - 1 / steps);
	let high = Math.min(1, best + 1 / steps);
	for (let round = 0; round < 30; round++) {
		const a = low + (high - low) / 3;
		const b = high - (high - low) / 3;
		if (distance(a) < distance(b)) high = b;
		else low = a;
	}
	const t = (low + high) / 2;
	return { t, ...at(t), distance: distance(t) };
}

// ---- Anchors and subpaths ------------------------------------------------------------------------

/** An anchor with no handles. */
export const corner = (x: number, y: number): Anchor => [x, y, x, y, x, y, 0];

export const hasHandles = (anchor: Anchor) =>
	anchor[2] !== anchor[0] ||
	anchor[3] !== anchor[1] ||
	anchor[4] !== anchor[0] ||
	anchor[5] !== anchor[1];

export function transformAnchor(anchor: Anchor, m: Matrix): Anchor {
	const point = apply(m, anchor[0], anchor[1]);
	const handleIn = apply(m, anchor[2], anchor[3]);
	const handleOut = apply(m, anchor[4], anchor[5]);
	return [point.x, point.y, handleIn.x, handleIn.y, handleOut.x, handleOut.y, anchor[6]];
}

export function transformSubpaths(paths: Subpath[], m: Matrix): Subpath[] {
	if (sameMatrix(m, IDENTITY)) return paths;
	return paths.map((path) => ({
		closed: path.closed,
		anchors: path.anchors.map((anchor) => transformAnchor(anchor, m))
	}));
}

const round = (value: number) => Math.round(value * 100) / 100;

/** SVG path data for subpaths: straight segments as lines, the rest as cubics. */
export function pathData(paths: Subpath[]) {
	const parts: string[] = [];
	for (const path of paths) {
		const first = path.anchors[0];
		if (!first) continue;
		parts.push(`M${round(first[0])} ${round(first[1])}`);
		for (const segment of segments(path)) {
			const [, , x1, y1, x2, y2, x3, y3] = segment;
			parts.push(
				isStraight(segment)
					? `L${round(x3)} ${round(y3)}`
					: `C${round(x1)} ${round(y1)} ${round(x2)} ${round(y2)} ${round(x3)} ${round(y3)}`
			);
		}
		if (path.closed) parts.push('Z');
	}
	return parts.join('');
}

// ---- The outline of each kind of shape ------------------------------------------------------------

/** The length of a handle that makes a quarter circle from cubics. */
export const KAPPA = 0.5522847498;

function rectOutline(width: number, height: number, radius: number): Subpath {
	const r = Math.max(0, Math.min(radius, width / 2, height / 2));
	if (r === 0) {
		return {
			closed: true,
			anchors: [corner(0, 0), corner(width, 0), corner(width, height), corner(0, height)]
		};
	}
	const k = KAPPA * r;
	const w = width;
	const h = height;
	return {
		closed: true,
		anchors: [
			[r, 0, r - k, 0, r, 0, 0],
			[w - r, 0, w - r, 0, w - r + k, 0, 0],
			[w, r, w, r - k, w, r, 0],
			[w, h - r, w, h - r, w, h - r + k, 0],
			[w - r, h, w - r + k, h, w - r, h, 0],
			[r, h, r, h, r - k, h, 0],
			[0, h - r, 0, h - r + k, 0, h - r, 0],
			[0, r, 0, r, 0, r - k, 0]
		]
	};
}

function ellipseOutline(width: number, height: number): Subpath {
	const rx = width / 2;
	const ry = height / 2;
	const kx = KAPPA * rx;
	const ky = KAPPA * ry;
	return {
		closed: true,
		anchors: [
			[rx, 0, rx - kx, 0, rx + kx, 0, 2],
			[width, ry, width, ry - ky, width, ry + ky, 2],
			[rx, height, rx + kx, height, rx - kx, height, 2],
			[0, ry, 0, ry + ky, 0, ry - ky, 2]
		]
	};
}

/** Points round a circle, starting at the top, stretched so they fill the box exactly. */
function fittedPoints(radii: number[], width: number, height: number): Subpath {
	const raw = radii.map((radius, index) => {
		const angle = -Math.PI / 2 + (index * 2 * Math.PI) / radii.length;
		return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
	});
	const minX = Math.min(...raw.map((point) => point.x));
	const maxX = Math.max(...raw.map((point) => point.x));
	const minY = Math.min(...raw.map((point) => point.y));
	const maxY = Math.max(...raw.map((point) => point.y));
	return {
		closed: true,
		anchors: raw.map((point) =>
			corner(
				((point.x - minX) / (maxX - minX || 1)) * width,
				((point.y - minY) / (maxY - minY || 1)) * height
			)
		)
	};
}

/** A shape's outline in its own coordinates. A group has none of its own. */
export function outline(shape: Shape): Subpath[] {
	switch (shape.kind) {
		case 'rect':
			return [rectOutline(shape.width, shape.height, shape.radius)];
		case 'ellipse':
			return [ellipseOutline(shape.width, shape.height)];
		case 'polygon':
			return [fittedPoints(Array(shape.sides).fill(1), shape.width, shape.height)];
		case 'star': {
			const radii = Array.from({ length: shape.points * 2 }, (_, index) =>
				index % 2 ? shape.inner : 1
			);
			return [fittedPoints(radii, shape.width, shape.height)];
		}
		case 'line':
			return [{ closed: false, anchors: [corner(shape.x1, shape.y1), corner(shape.x2, shape.y2)] }];
		case 'path':
			return shape.paths;
		case 'group':
			return [];
		case 'text': {
			const layout = layoutText(shape);
			return [rectOutline(layout.width, layout.height, 0)];
		}
	}
}

/** A shape's bounds through a transform (its own included), from its geometry: strokes aside. */
export function shapeBounds(shape: Shape, m: Matrix = IDENTITY): Bounds | null {
	const placed = multiply(m, shape.transform);
	if (shape.kind === 'group') {
		let bounds: Bounds | null = null;
		for (const child of shape.children) bounds = union(bounds, shapeBounds(child, placed));
		return bounds;
	}
	return subpathBounds(outline(shape), placed);
}

/** A shape's bounds in its own coordinates: the box its handles are drawn round. */
export function localBounds(shape: Shape): Bounds | null {
	if (shape.kind === 'group') {
		let bounds: Bounds | null = null;
		for (const child of shape.children) bounds = union(bounds, shapeBounds(child));
		return bounds;
	}
	return subpathBounds(outline(shape));
}

// ---- Changing a shape's size ------------------------------------------------------------------------

const isBox = (shape: Shape): shape is BoxShape =>
	shape.kind === 'rect' ||
	shape.kind === 'ellipse' ||
	shape.kind === 'polygon' ||
	shape.kind === 'star';

/**
 * The shape with its transform's scale moved into its geometry, so a resized shape keeps its
 * stroke's width and its corners' radius, as in a designer's tools. Its transform is left as a
 * move and a turn (and a mirror, for a shape drawn in a box). A shear stays in the transform.
 */
export function normalize(shape: Shape): Shape {
	const parts = decompose(shape.transform);
	const scale = Math.max(parts.scaleX, Math.abs(parts.scaleY));
	if (Math.abs(parts.shear) > 1e-6 * Math.max(1, scale)) return shape;
	const sx = parts.scaleX;
	const sy = parts.scaleY;
	const plain = Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9;
	if (plain) return shape;
	if (isBox(shape)) {
		if (Math.abs(sx - 1) < 1e-9 && Math.abs(Math.abs(sy) - 1) < 1e-9) return shape;
		return {
			...shape,
			width: shape.width * sx,
			height: shape.height * Math.abs(sy),
			transform: compose({ ...parts, scaleX: 1, scaleY: Math.sign(sy) || 1, shear: 0 })
		};
	}
	if (shape.kind === 'text') {
		// Letters aren't stretched: the size takes the scale that changed most (a side's handle
		// changes one), and a mirror stays in the transform.
		const across = Math.abs(sx);
		const down = Math.abs(sy);
		const scale = Math.abs(Math.log(across)) >= Math.abs(Math.log(down)) ? across : down;
		return {
			...shape,
			size: Math.max(1, Math.min(5000, shape.size * scale)),
			transform: compose({ ...parts, scaleX: 1, scaleY: Math.sign(sy) || 1, shear: 0 })
		};
	}
	const turn = compose({ ...parts, scaleX: 1, scaleY: 1, shear: 0 });
	const stretch = scaling(sx, sy);
	switch (shape.kind) {
		case 'line': {
			const start = apply(stretch, shape.x1, shape.y1);
			const end = apply(stretch, shape.x2, shape.y2);
			return { ...shape, x1: start.x, y1: start.y, x2: end.x, y2: end.y, transform: turn };
		}
		case 'path':
			return { ...shape, paths: transformSubpaths(shape.paths, stretch), transform: turn };
		case 'group':
			return {
				...shape,
				transform: turn,
				children: shape.children.map((child) =>
					normalize({ ...child, transform: multiply(stretch, child.transform) })
				)
			};
	}
	return shape;
}

/** The shape moved, turned or scaled by m in its parent's coordinates, scale kept out of its strokes. */
export function transformShape(shape: Shape, m: Matrix): Shape {
	return normalize({ ...shape, transform: multiply(m, shape.transform) });
}

/**
 * A shape's geometry as a path, for editing its points: it keeps its look, transform and paint.
 * A text stays a text: it has no points to edit.
 */
export function toPath(shape: Shape): Shape {
	if (shape.kind === 'path' || shape.kind === 'group' || shape.kind === 'text') return shape;
	const paths = outline(shape);
	const base = {
		id: shape.id,
		name: shape.name,
		transform: shape.transform,
		opacity: shape.opacity,
		hidden: shape.hidden,
		locked: shape.locked
	};
	if (shape.kind === 'line') {
		return { ...base, kind: 'path', paths, fill: null, stroke: shape.stroke, fillRule: 'nonzero' };
	}
	return {
		...base,
		kind: 'path',
		paths,
		fill: shape.fill,
		stroke: shape.stroke,
		fillRule: 'nonzero'
	};
}
