// The points tool (A): edit a shape point by point. Click a point to pick it (Shift for more, or
// drag a box round them), drag to move them, drag a handle to bend the curve (a smooth point's
// other handle follows; Alt breaks them apart). Double-click a point to make it a corner or
// smooth, double-click a segment to add a point there, and Delete takes picked points away.
//
// A rectangle, ellipse, polygon or star becomes a path the first time a point is moved. A line's
// two ends move on their own.

import type { Anchor, Drawing, Shape, Subpath } from '$lib/drawing';
import { locate, mapShapes } from '../edit';
import {
	apply,
	invert,
	multiply,
	outline,
	pathData,
	toPath,
	transformSubpaths,
	type Point
} from '../geometry';
import { shapeAt } from '../render';
import type { Studio } from '../studio.svelte';
import {
	insertAnchor,
	moveAnchor,
	moveHandle,
	nearestAnchor,
	nearestSegment,
	pointSet,
	removeAnchors,
	toggleSmooth,
	unique
} from './path-edit';
import { noChrome, pointsCursor, snap45, type Chrome, type Press, type Tool } from './tool';

/** A picked point: the shape, then "path:index". */
type Picked = Record<string, string[]>;

/** `origin` is the drawing as the press found it, before any shape was made a path: one undo step. */
type Op =
	| {
			kind: 'points';
			start: Press;
			origin: Drawing;
			doc: Drawing;
			selection: string[];
			moved: boolean;
	  }
	| {
			kind: 'handle';
			id: string;
			path: number;
			index: number;
			which: 'in' | 'out';
			origin: Drawing;
			doc: Drawing;
			selection: string[];
			broke: boolean;
	  }
	| { kind: 'marquee'; start: Press; current: Press; picked: Picked };

const REACH = 7;

/**
 * The points a shape is edited by: its own, or its outline's for a shape that isn't a path yet. A
 * text and a picture have none.
 */
function editable(shape: Shape): Subpath[] {
	if (shape.kind === 'path') return shape.paths;
	if (shape.kind === 'group' || shape.kind === 'text' || shape.kind === 'image') return [];
	return outline(shape);
}

export class DirectTool implements Tool {
	#studio: Studio;
	picked = $state.raw<Picked>({});
	op = $state.raw<Op | null>(null);
	cursor = pointsCursor;

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	/** Each picked shape that has points, with how it sits on the drawing. */
	#shapes() {
		const studio = this.#studio;
		return studio.selection
			.map((id) => locate(studio.doc, id))
			.filter(
				(found) =>
					!!found &&
					found.shape.kind !== 'group' &&
					found.shape.kind !== 'text' &&
					found.shape.kind !== 'image'
			)
			.map((found) => ({
				id: found!.shape.id,
				shape: found!.shape,
				matrix: multiply(found!.matrix, found!.shape.transform)
			}));
	}

	get chrome(): Chrome {
		const chrome = noChrome();
		const studio = this.#studio;
		const view = studio.viewMatrix();
		for (const { id, shape, matrix } of this.#shapes()) {
			const m = multiply(view, matrix);
			const paths = transformSubpaths(editable(shape), m);
			chrome.paths.push({ d: pathData(paths), kind: 'selected' });
			const picked = pointSet(this.picked[id]);
			paths.forEach((path, pathIndex) => {
				const count = path.anchors.length;
				path.anchors.forEach((anchor, index) => {
					const selected = picked.has(`${pathIndex}:${index}`);
					chrome.anchors.push({ x: anchor[0], y: anchor[1], selected });
					// Handles show on picked points, and on their neighbours' sides facing them.
					const before =
						picked.has(`${pathIndex}:${(index + 1) % count}`) && (path.closed || index < count - 1);
					const after =
						picked.has(`${pathIndex}:${(index - 1 + count) % count}`) && (path.closed || index > 0);
					if ((selected || after) && (anchor[2] !== anchor[0] || anchor[3] !== anchor[1])) {
						chrome.handles.push({ x: anchor[2], y: anchor[3], ax: anchor[0], ay: anchor[1] });
					}
					if ((selected || before) && (anchor[4] !== anchor[0] || anchor[5] !== anchor[1])) {
						chrome.handles.push({ x: anchor[4], y: anchor[5], ax: anchor[0], ay: anchor[1] });
					}
				});
			});
		}
		if (this.op?.kind === 'marquee') {
			const { start, current } = this.op;
			chrome.marquee = {
				x: Math.min(start.sx, current.sx),
				y: Math.min(start.sy, current.sy),
				width: Math.abs(current.sx - start.sx),
				height: Math.abs(current.sy - start.sy)
			};
		}
		return chrome;
	}

	/** What's under the pointer: a handle, a point or a segment of a picked shape. */
	#at(press: Press) {
		const zoom = this.#studio.view.zoom;
		const reach = REACH / zoom;
		const view = this.#studio.viewMatrix();
		const chrome = this.chrome;
		for (const handle of chrome.handles) {
			if (Math.hypot(handle.x - press.sx, handle.y - press.sy) > REACH) continue;
			// Which point and which side, from the shapes themselves.
			for (const { id, shape, matrix } of this.#shapes()) {
				const m = multiply(view, matrix);
				const paths = editable(shape);
				for (let path = 0; path < paths.length; path++) {
					for (let index = 0; index < paths[path].anchors.length; index++) {
						const anchor = paths[path].anchors[index];
						for (const which of ['in', 'out'] as const) {
							const at = which === 'in' ? 2 : 4;
							const point = apply(m, anchor[at], anchor[at + 1]);
							if (Math.abs(point.x - handle.x) < 0.01 && Math.abs(point.y - handle.y) < 0.01) {
								return { kind: 'handle' as const, id, path, index, which };
							}
						}
					}
				}
			}
		}
		for (const { id, shape, matrix } of this.#shapes()) {
			const back = invert(matrix);
			if (!back) continue;
			const local = apply(back, press.x, press.y);
			const paths = editable(shape);
			const anchor = nearestAnchor(paths, local.x, local.y, reach);
			if (anchor) return { kind: 'anchor' as const, id, key: `${anchor.path}:${anchor.index}` };
			const segment = nearestSegment(paths, local.x, local.y, reach);
			if (segment) return { kind: 'segment' as const, id, ...segment };
		}
		return null;
	}

	/** The picked shapes made paths (a line stays a line), ready to have points moved. */
	#asPaths(doc: Drawing, ids: string[]) {
		return mapShapes(doc, ids, (shape) =>
			shape.kind === 'line' || shape.kind === 'path' ? shape : toPath(shape)
		);
	}

	down(press: Press) {
		const studio = this.#studio;
		const at = this.#at(press);
		if (at?.kind === 'handle') {
			const origin = studio.doc;
			const doc = this.#asPaths(origin, [at.id]);
			studio.live(doc);
			this.op = {
				kind: 'handle',
				id: at.id,
				path: at.path,
				index: at.index,
				which: at.which,
				origin,
				doc,
				selection: studio.selection,
				broke: press.alt
			};
			return;
		}
		if (at?.kind === 'anchor' || at?.kind === 'segment') {
			let keys: string[];
			if (at.kind === 'anchor') keys = [at.key];
			else {
				const paths = editable(locate(studio.doc, at.id)!.shape);
				const count = paths[at.path].anchors.length;
				keys = [`${at.path}:${at.segment}`, `${at.path}:${(at.segment + 1) % count}`];
			}
			const current = this.picked[at.id] ?? [];
			const already = keys.every((key) => current.includes(key));
			if (press.shift) {
				this.picked = {
					...this.picked,
					[at.id]: already
						? current.filter((key) => !keys.includes(key))
						: unique([...current, ...keys])
				};
			} else if (!already) {
				this.picked = { [at.id]: keys };
			}
			this.op = {
				kind: 'points',
				start: press,
				origin: studio.doc,
				doc: studio.doc,
				selection: studio.selection,
				moved: false
			};
			return;
		}
		const hit = shapeAt(studio.doc, press.x, press.y, 5 / studio.view.zoom, true);
		if (hit) {
			studio.select(press.shift ? unique([...studio.selection, hit.id]) : [hit.id]);
			if (!press.shift) this.picked = {};
			return;
		}
		this.op = {
			kind: 'marquee',
			start: press,
			current: press,
			picked: press.shift ? this.picked : {}
		};
		if (!press.shift) this.picked = {};
	}

	move(press: Press, pressed: boolean) {
		const op = this.op;
		if (!pressed || !op) return;
		if (op.kind === 'marquee') return this.#marquee(op, press);
		if (op.kind === 'handle') return this.#handle(op, press);
		this.#points(op, press);
	}

	#points(op: Extract<Op, { kind: 'points' }>, press: Press) {
		const studio = this.#studio;
		if (!op.moved) {
			if (Math.hypot(press.sx - op.start.sx, press.sy - op.start.sy) < 3) return;
			op.moved = true;
			op.doc = this.#asPaths(op.doc, Object.keys(this.picked));
		}
		let dx = press.x - op.start.x;
		let dy = press.y - op.start.y;
		if (press.shift) {
			if (Math.abs(dx) > Math.abs(dy)) dy = 0;
			else dx = 0;
		}
		const picked = this.picked;
		const next = mapShapes(op.doc, Object.keys(picked), (shape) => {
			const found = locate(op.doc, shape.id);
			if (!found) return shape;
			const back = invert(multiply(found.matrix, shape.transform));
			if (!back) return shape;
			// The move, as the shape's own coordinates see it.
			const origin = apply(back, 0, 0);
			const moved = apply(back, dx, dy);
			const ldx = moved.x - origin.x;
			const ldy = moved.y - origin.y;
			const keys = pointSet(picked[shape.id]);
			if (shape.kind === 'line') {
				return {
					...shape,
					...(keys.has('0:0') ? { x1: shape.x1 + ldx, y1: shape.y1 + ldy } : {}),
					...(keys.has('0:1') ? { x2: shape.x2 + ldx, y2: shape.y2 + ldy } : {})
				};
			}
			if (shape.kind !== 'path') return shape;
			const paths = shape.paths.map((path, pathIndex) => ({
				...path,
				anchors: path.anchors.map((anchor, index) =>
					keys.has(`${pathIndex}:${index}`) ? moveAnchor(anchor, ldx, ldy) : anchor
				)
			}));
			return { ...shape, paths };
		});
		studio.live(next, op.selection);
	}

	#handle(op: Extract<Op, { kind: 'handle' }>, press: Press) {
		const studio = this.#studio;
		const found = locate(op.doc, op.id);
		if (!found || found.shape.kind !== 'path') return;
		const back = invert(multiply(found.matrix, found.shape.transform));
		if (!back) return;
		let point: Point = apply(back, press.x, press.y);
		const anchor = found.shape.paths[op.path].anchors[op.index];
		if (press.shift) point = snap45({ x: anchor[0], y: anchor[1] }, point);
		op.broke ||= press.alt;
		const changed = moveHandle(anchor, op.which, point.x, point.y, op.broke);
		const paths = found.shape.paths.map((path, pathIndex) =>
			pathIndex === op.path
				? {
						...path,
						anchors: path.anchors.map((item, index): Anchor =>
							index === op.index ? changed : item
						)
					}
				: path
		);
		studio.live(
			mapShapes(op.doc, [op.id], (shape) => (shape.kind === 'path' ? { ...shape, paths } : shape)),
			op.selection
		);
	}

	#marquee(op: Extract<Op, { kind: 'marquee' }>, press: Press) {
		op.current = press;
		this.op = { ...op };
		const box = {
			minX: Math.min(op.start.sx, press.sx),
			minY: Math.min(op.start.sy, press.sy),
			maxX: Math.max(op.start.sx, press.sx),
			maxY: Math.max(op.start.sy, press.sy)
		};
		const view = this.#studio.viewMatrix();
		const picked: Picked = { ...op.picked };
		for (const { id, shape, matrix } of this.#shapes()) {
			const m = multiply(view, matrix);
			const keys = pointSet(op.picked[id]);
			editable(shape).forEach((path, pathIndex) =>
				path.anchors.forEach((anchor, index) => {
					const point = apply(m, anchor[0], anchor[1]);
					if (
						point.x >= box.minX &&
						point.x <= box.maxX &&
						point.y >= box.minY &&
						point.y <= box.maxY
					) {
						keys.add(`${pathIndex}:${index}`);
					}
				})
			);
			picked[id] = [...keys];
		}
		this.picked = picked;
	}

	up() {
		const op = this.op;
		this.op = null;
		if (!op || op.kind === 'marquee') return;
		if (op.kind === 'points' && !op.moved) return;
		this.#studio.settle(op.origin, op.selection);
	}

	double(press: Press) {
		const studio = this.#studio;
		const at = this.#at(press);
		if (at?.kind === 'anchor') {
			const [path, index] = at.key.split(':').map(Number);
			const doc = this.#asPaths(studio.doc, [at.id]);
			studio.apply(
				mapShapes(doc, [at.id], (shape) =>
					shape.kind === 'path'
						? { ...shape, paths: toggleSmooth(shape.paths, path, index) }
						: shape
				)
			);
			return;
		}
		if (at?.kind === 'segment') {
			const doc = this.#asPaths(studio.doc, [at.id]);
			const found = locate(doc, at.id);
			if (found?.shape.kind !== 'path') return;
			studio.apply(
				mapShapes(doc, [at.id], (shape) =>
					shape.kind === 'path'
						? { ...shape, paths: insertAnchor(shape.paths, at.path, at.segment, at.t) }
						: shape
				)
			);
			this.picked = { [at.id]: [`${at.path}:${at.segment + 1}`] };
			return;
		}
		if (!shapeAt(studio.doc, press.x, press.y, 5 / studio.view.zoom, true))
			studio.toolId = 'select';
	}

	key(event: KeyboardEvent) {
		if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
		const ids = Object.keys(this.picked).filter((id) => this.picked[id].length);
		if (!ids.length) return false;
		const studio = this.#studio;
		const doc = this.#asPaths(
			studio.doc,
			ids.filter((id) => locate(studio.doc, id)?.shape.kind !== 'line')
		);
		const next = mapShapes(doc, ids, (shape) => {
			if (shape.kind === 'line') return null;
			if (shape.kind !== 'path') return shape;
			const paths = removeAnchors(shape.paths, this.picked[shape.id] ?? []);
			return paths.length ? { ...shape, paths } : null;
		});
		studio.apply(
			next,
			studio.selection.filter((id) => locate(next, id))
		);
		this.picked = {};
		return true;
	}

	/** Esc: let go of the points, then of the tool. */
	cancel() {
		if (Object.values(this.picked).some((keys) => keys.length)) {
			this.picked = {};
			return true;
		}
		this.#studio.toolId = 'select';
		return true;
	}

	finish() {
		this.#studio.toolId = 'select';
		return true;
	}

	leave() {
		this.op = null;
		this.picked = {};
	}
}
