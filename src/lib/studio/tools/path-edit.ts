// Editing a path's points, shared by the pen and the points tool. Each returns new subpaths and
// leaves the ones it was given alone. No DOM.

import type { Anchor, Subpath } from '$lib/drawing';
import {
	corner,
	isStraight,
	nearestOnSegment,
	segments,
	splitSegment,
	type Segment
} from '../geometry';

/** Adds a point on a segment at t, keeping the curve's shape. */
export function insertAnchor(
	paths: Subpath[],
	pathIndex: number,
	segmentIndex: number,
	t: number
): Subpath[] {
	const path = paths[pathIndex];
	const segment = [...segments(path)][segmentIndex];
	if (!segment) return paths;
	const anchors = [...path.anchors];
	const next = (segmentIndex + 1) % anchors.length;
	if (isStraight(segment)) {
		const [x0, y0, , , , , x3, y3] = segment;
		anchors.splice(segmentIndex + 1, 0, corner(x0 + (x3 - x0) * t, y0 + (y3 - y0) * t));
	} else {
		const [first, second] = splitSegment(segment, t);
		const from = anchors[segmentIndex];
		const to = anchors[next];
		anchors[segmentIndex] = [from[0], from[1], from[2], from[3], first[2], first[3], from[6]];
		anchors[next] = [to[0], to[1], second[4], second[5], to[4], to[5], to[6]];
		anchors.splice(segmentIndex + 1, 0, [
			first[6],
			first[7],
			first[4],
			first[5],
			second[2],
			second[3],
			1
		]);
	}
	return paths.map((item, index) => (index === pathIndex ? { ...item, anchors } : item));
}

/**
 * Points named "path:index", as a set to look them up in. A working set for one step of an edit,
 * never state, so it's made here rather than in the tools' .svelte.ts files (where the lint asks
 * for a reactive one).
 */
export const pointSet = (keys: Iterable<string> = []) => new Set(keys);

/** The items with repeats taken out, in their first order. */
export const unique = <T>(items: Iterable<T>) => [...new Set(items)];

/** Takes a point out. A path left with one point goes; an empty list means nothing's left. */
export function removeAnchors(paths: Subpath[], points: Iterable<string>): Subpath[] {
	const remove = pointSet(points);
	const kept: Subpath[] = [];
	paths.forEach((path, pathIndex) => {
		const anchors = path.anchors.filter((_, index) => !remove.has(`${pathIndex}:${index}`));
		if (anchors.length >= 2) kept.push({ closed: path.closed && anchors.length > 2, anchors });
	});
	return kept;
}

/** Turns a point into a corner (its handles drawn in) or a smooth point (handles along its neighbours). */
export function toggleSmooth(paths: Subpath[], pathIndex: number, index: number): Subpath[] {
	const path = paths[pathIndex];
	const anchors = [...path.anchors];
	const anchor = anchors[index];
	const [x, y] = anchor;
	const hasHandles = anchor[2] !== x || anchor[3] !== y || anchor[4] !== x || anchor[5] !== y;
	if (hasHandles) {
		anchors[index] = corner(x, y);
	} else {
		const count = anchors.length;
		const before = anchors[(index - 1 + count) % count];
		const after = anchors[(index + 1) % count];
		const open = !path.closed;
		const prev = open && index === 0 ? null : before;
		const next = open && index === count - 1 ? null : after;
		// The handles lie along the line between the neighbours, a third of the way to each.
		const dx = (next?.[0] ?? x) - (prev?.[0] ?? x);
		const dy = (next?.[1] ?? y) - (prev?.[1] ?? y);
		const span = Math.hypot(dx, dy) || 1;
		const ux = dx / span;
		const uy = dy / span;
		const inLength = prev ? Math.hypot(prev[0] - x, prev[1] - y) / 3 : 0;
		const outLength = next ? Math.hypot(next[0] - x, next[1] - y) / 3 : 0;
		anchors[index] = [
			x,
			y,
			x - ux * inLength,
			y - uy * inLength,
			x + ux * outLength,
			y + uy * outLength,
			1
		];
	}
	return paths.map((item, at) => (at === pathIndex ? { ...item, anchors } : item));
}

/**
 * Moves one handle of a point to (hx, hy). The other follows by the point's kind: a symmetric
 * point mirrors it, a smooth one keeps it in line at its own length, a corner leaves it.
 * `breakIt` turns the point into a corner first.
 */
export function moveHandle(
	anchor: Anchor,
	which: 'in' | 'out',
	hx: number,
	hy: number,
	breakIt: boolean
): Anchor {
	const [x, y] = anchor;
	const kind = breakIt ? 0 : anchor[6];
	const next: Anchor = [...anchor];
	next[6] = kind;
	const own = which === 'in' ? 2 : 4;
	const other = which === 'in' ? 4 : 2;
	next[own] = hx;
	next[own + 1] = hy;
	if (kind === 0) return next;
	const dx = hx - x;
	const dy = hy - y;
	const length = Math.hypot(dx, dy);
	if (!length) return next;
	const keep = kind === 2 ? length : Math.hypot(anchor[other] - x, anchor[other + 1] - y);
	next[other] = x - (dx / length) * keep;
	next[other + 1] = y - (dy / length) * keep;
	return next;
}

/** Moves a point, its handles going with it. */
export const moveAnchor = (anchor: Anchor, dx: number, dy: number): Anchor => [
	anchor[0] + dx,
	anchor[1] + dy,
	anchor[2] + dx,
	anchor[3] + dy,
	anchor[4] + dx,
	anchor[5] + dy,
	anchor[6]
];

/** The nearest segment to a point, within reach: which path and segment, and where on it. */
export function nearestSegment(paths: Subpath[], x: number, y: number, reach: number) {
	let best: {
		path: number;
		segment: number;
		t: number;
		distance: number;
		x: number;
		y: number;
	} | null = null;
	paths.forEach((path, pathIndex) => {
		let index = 0;
		for (const segment of segments(path) as Generator<Segment>) {
			const found = nearestOnSegment(segment, x, y);
			if (found.distance <= reach && (!best || found.distance < best.distance)) {
				best = { path: pathIndex, segment: index, ...found };
			}
			index++;
		}
	});
	return best as {
		path: number;
		segment: number;
		t: number;
		distance: number;
		x: number;
		y: number;
	} | null;
}

/** The nearest point to (x, y) within reach: its path and place, or null. */
export function nearestAnchor(paths: Subpath[], x: number, y: number, reach: number) {
	let best: { path: number; index: number; distance: number } | null = null;
	paths.forEach((path, pathIndex) =>
		path.anchors.forEach((anchor, index) => {
			const distance = Math.hypot(anchor[0] - x, anchor[1] - y);
			if (distance <= reach && (!best || distance < best.distance))
				best = { path: pathIndex, index, distance };
		})
	);
	return best as { path: number; index: number; distance: number } | null;
}
