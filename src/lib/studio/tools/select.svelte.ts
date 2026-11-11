// The select tool (V): click to pick a shape (Shift to add or take away, Ctrl or Cmd to reach
// inside a group), drag to move (Shift keeps to a line, Alt moves a copy), drag a handle to
// resize (Shift keeps the proportions, Alt resizes from the centre), drag just outside a corner to
// turn (Shift in steps of 15°), drag on empty space to pick everything a box touches. A line has
// a handle on each end instead. Double-click a group to pick inside it, a text to type into it,
// or a shape to edit its points.

import type { Drawing, LineShape } from '$lib/drawing';
import { duplicateShapes, locate, outermost, transformShapes, mapShapes } from '../edit';
import {
	apply,
	corners,
	decompose,
	intersects,
	invert,
	multiply,
	rotation,
	scaling,
	shapeBounds,
	transformShape,
	translation,
	type Point
} from '../geometry';
import { shapeAt } from '../render';
import type { Studio } from '../studio.svelte';
import { handlePoints, screenOutline, selectionFrame, type Frame } from './marks';
import {
	angleOf,
	arrowCursor,
	measure,
	noChrome,
	resizeCursor,
	rotateCursor,
	snap45,
	type Chrome,
	type Press,
	type Tool
} from './tool';

type Grip =
	| { kind: 'resize'; handle: number }
	| { kind: 'rotate'; corner: number }
	| { kind: 'end'; end: 1 | 2 };

type Op =
	| {
			kind: 'move';
			start: Press;
			/** The drawing as the press found it, for undo and Esc. */
			origin: Drawing;
			/** What moves: the origin, or with Alt the origin with copies in it. */
			doc: Drawing;
			selection: string[];
			ids: string[];
			moved: boolean;
			clicked: string | null;
	  }
	| {
			kind: 'resize';
			handle: number;
			start: Press;
			doc: Drawing;
			selection: string[];
			frame: Frame;
			grab: Point;
			/** Only text is picked. */
			texts: boolean;
			/** Only pictures (and text) are picked: they keep their proportions unless Shift is held. */
			pictures: boolean;
	  }
	| {
			kind: 'rotate';
			start: Press;
			doc: Drawing;
			selection: string[];
			centre: Point;
			base: number;
			from: number;
	  }
	| { kind: 'end'; end: 1 | 2; start: Press; doc: Drawing; selection: string[]; id: string }
	| { kind: 'marquee'; start: Press; current: Press; selection: string[] };

const HANDLE = 7;
const ROTATE = 24;
const SNAP = Math.PI / 12;

export class SelectTool implements Tool {
	#studio: Studio;
	op = $state.raw<Op | null>(null);
	grip = $state.raw<Grip | null>(null);
	alt = $state(false);
	label = $state.raw<Chrome['label']>(null);

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	/** A single line on its own, which gets end handles instead of a box. */
	#line = $derived.by(() => {
		const { selection, doc } = this.#studio;
		if (selection.length !== 1) return null;
		const found = locate(doc, selection[0]);
		return found?.shape.kind === 'line'
			? { shape: found.shape, matrix: multiply(found.matrix, found.shape.transform) }
			: null;
	});

	#frame = $derived.by(() => selectionFrame(this.#studio.doc, this.#studio.selection));

	get cursor() {
		const grip = this.grip;
		const frame = this.#frame;
		if (grip?.kind === 'end') return 'move';
		if (grip && frame) {
			const view = this.#studio.viewMatrix();
			const box = multiply(view, frame.matrix);
			const centre = apply(
				box,
				(frame.bounds.minX + frame.bounds.maxX) / 2,
				(frame.bounds.minY + frame.bounds.maxY) / 2
			);
			const points = handlePoints(frame.bounds).map((point) => apply(box, point.x, point.y));
			if (grip.kind === 'resize') return resizeCursor(angleOf(centre, points[grip.handle]));
			return rotateCursor(angleOf(centre, points[grip.corner * 2]));
		}
		return arrowCursor(this.alt && this.#studio.hoverId ? 'copy' : '');
	}

	get chrome(): Chrome {
		const studio = this.#studio;
		const view = studio.viewMatrix();
		const chrome = noChrome();
		const { hoverId, selection, doc } = studio;
		if (hoverId && !selection.includes(hoverId) && !this.op) {
			const d = screenOutline(doc, hoverId, view);
			if (d) chrome.paths.push({ d, kind: 'hover' });
		}
		for (const id of selection) {
			const d = screenOutline(doc, id, view);
			if (d) chrome.paths.push({ d, kind: 'selected' });
		}
		const line = this.#line;
		if (line) {
			const m = multiply(view, line.matrix);
			const a = apply(m, line.shape.x1, line.shape.y1);
			const b = apply(m, line.shape.x2, line.shape.y2);
			chrome.anchors.push({ ...a, selected: true }, { ...b, selected: true });
		} else if (this.#frame && this.op?.kind !== 'marquee') {
			const frame = this.#frame;
			const screen = corners(frame.bounds, multiply(view, frame.matrix));
			chrome.box = { corners: screen, handles: !(this.op?.kind === 'move' && this.op.moved) };
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
		chrome.label = this.label;
		return chrome;
	}

	/** What's under the pointer among the selection's handles. */
	#gripAt(press: Press): Grip | null {
		const studio = this.#studio;
		const view = studio.viewMatrix();
		const line = this.#line;
		if (line) {
			const m = multiply(view, line.matrix);
			for (const end of [1, 2] as const) {
				const point = apply(
					m,
					end === 1 ? line.shape.x1 : line.shape.x2,
					end === 1 ? line.shape.y1 : line.shape.y2
				);
				if (Math.hypot(point.x - press.sx, point.y - press.sy) <= HANDLE + 2)
					return { kind: 'end', end };
			}
			return null;
		}
		const frame = this.#frame;
		if (!frame) return null;
		const box = multiply(view, frame.matrix);
		const points = handlePoints(frame.bounds).map((point) => apply(box, point.x, point.y));
		const width = Math.hypot(points[2].x - points[0].x, points[2].y - points[0].y);
		const height = Math.hypot(points[6].x - points[0].x, points[6].y - points[0].y);
		const small = Math.min(width, height) < 24;
		for (let handle = 0; handle < 8; handle++) {
			if (small && handle % 2) continue;
			// A flat box (a straight path) has no sides to pull apart, only its ends.
			if (
				(width < 1 && (handle === 1 || handle === 5)) ||
				(height < 1 && (handle === 3 || handle === 7))
			)
				continue;
			if (Math.hypot(points[handle].x - press.sx, points[handle].y - press.sy) <= HANDLE)
				return { kind: 'resize', handle };
		}
		const back = invert(box);
		if (!back) return null;
		const local = apply(back, press.sx, press.sy);
		const { minX, minY, maxX, maxY } = frame.bounds;
		const inside = local.x >= minX && local.x <= maxX && local.y >= minY && local.y <= maxY;
		if (inside) return null;
		for (let corner = 0; corner < 4; corner++) {
			const point = points[corner * 2];
			if (Math.hypot(point.x - press.sx, point.y - press.sy) <= ROTATE)
				return { kind: 'rotate', corner };
		}
		return null;
	}

	#hit(press: Press) {
		return shapeAt(this.#studio.doc, press.x, press.y, 5 / this.#studio.view.zoom, press.mod);
	}

	down(press: Press) {
		const studio = this.#studio;
		this.alt = press.alt;
		const grip = this.#gripAt(press);
		const base = { start: press, doc: studio.doc, selection: studio.selection };
		if (grip?.kind === 'end') {
			this.op = { ...base, kind: 'end', end: grip.end, id: studio.selection[0] };
			return;
		}
		if (grip?.kind === 'resize' && this.#frame) {
			const frame = this.#frame;
			const back = invert(frame.matrix)!;
			const local = apply(back, press.x, press.y);
			const handle = handlePoints(frame.bounds)[grip.handle];
			this.op = {
				...base,
				kind: 'resize',
				handle: grip.handle,
				frame,
				grab: { x: local.x - handle.x, y: local.y - handle.y },
				texts: studio.selected.every((item) => item.shape.kind === 'text'),
				pictures:
					studio.selected.some((item) => item.shape.kind === 'image') &&
					studio.selected.every((item) => item.shape.kind === 'image' || item.shape.kind === 'text')
			};
			return;
		}
		if (grip?.kind === 'rotate' && this.#frame) {
			const frame = this.#frame;
			const centre = apply(
				frame.matrix,
				(frame.bounds.minX + frame.bounds.maxX) / 2,
				(frame.bounds.minY + frame.bounds.maxY) / 2
			);
			this.op = {
				...base,
				kind: 'rotate',
				centre,
				base: studio.selection.length === 1 ? decompose(frame.matrix).rotation : 0,
				from: Math.atan2(press.y - centre.y, press.x - centre.x)
			};
			return;
		}
		const hit = this.#hit(press);
		if (!hit) {
			if (!press.shift) studio.select([]);
			this.op = {
				kind: 'marquee',
				start: press,
				current: press,
				selection: press.shift ? studio.selection : []
			};
			return;
		}
		const picked = studio.selection.includes(hit.id);
		if (press.shift) {
			if (picked) {
				studio.select(studio.selection.filter((id) => id !== hit.id));
				return;
			}
			studio.select([...studio.selection, hit.id]);
		} else if (!picked) {
			studio.select([hit.id]);
		}
		this.op = {
			kind: 'move',
			start: press,
			origin: studio.doc,
			doc: studio.doc,
			selection: studio.selection,
			ids: outermost(studio.doc, studio.selection),
			moved: false,
			clicked: picked && !press.shift ? hit.id : null
		};
	}

	move(press: Press, pressed: boolean) {
		const studio = this.#studio;
		this.alt = press.alt;
		const op = this.op;
		if (!pressed || !op) {
			this.grip = this.#gripAt(press);
			studio.hoverId = this.grip ? null : (this.#hit(press)?.id ?? null);
			return;
		}
		switch (op.kind) {
			case 'move':
				return this.#move(op, press);
			case 'resize':
				return this.#resize(op, press);
			case 'rotate':
				return this.#rotate(op, press);
			case 'end':
				return this.#end(op, press);
			case 'marquee':
				return this.#marquee(op, press);
		}
	}

	#move(op: Extract<Op, { kind: 'move' }>, press: Press) {
		const studio = this.#studio;
		if (!op.moved && Math.hypot(press.sx - op.start.sx, press.sy - op.start.sy) < 3) return;
		if (!op.moved) {
			op.moved = true;
			if (press.alt) {
				// Alt: the copies move, and the originals stay where they were.
				const copied = duplicateShapes(op.doc, op.ids, 0, 0);
				op.doc = copied.doc;
				op.ids = copied.ids;
			}
			this.op = { ...op };
		}
		let dx = press.x - op.start.x;
		let dy = press.y - op.start.y;
		if (press.shift) {
			if (Math.abs(dx) > Math.abs(dy)) dy = 0;
			else dx = 0;
		}
		studio.live(transformShapes(op.doc, op.ids, translation(dx, dy), transformShape), op.ids);
		const bounds = studio.selectionBounds;
		this.label = bounds
			? {
					x: press.sx + 16,
					y: press.sy + 20,
					text: `${measure(bounds.minX)}, ${measure(bounds.minY)}`
				}
			: null;
	}

	#resize(op: Extract<Op, { kind: 'resize' }>, press: Press) {
		const studio = this.#studio;
		const { frame, handle } = op;
		const back = invert(frame.matrix);
		if (!back) return;
		const pointer = apply(back, press.x, press.y);
		const local = { x: pointer.x - op.grab.x, y: pointer.y - op.grab.y };
		const { minX, minY, maxX, maxY } = frame.bounds;
		const cx = (minX + maxX) / 2;
		const cy = (minY + maxY) / 2;
		const width = maxX - minX;
		const height = maxY - minY;
		const left = handle === 0 || handle === 6 || handle === 7;
		const right = handle === 2 || handle === 3 || handle === 4;
		const top = handle === 0 || handle === 1 || handle === 2;
		const bottom = handle === 4 || handle === 5 || handle === 6;
		// The point that stays put: the opposite side or corner, or the centre with Alt.
		const fixedX = press.alt ? cx : left ? maxX : right ? minX : cx;
		const fixedY = press.alt ? cy : top ? maxY : bottom ? minY : cy;
		const reachX = left ? minX - fixedX : right ? maxX - fixedX : 0;
		const reachY = top ? minY - fixedY : bottom ? maxY - fixedY : 0;
		let sx = reachX ? (local.x - fixedX) / reachX : 1;
		let sy = reachY ? (local.y - fixedY) / reachY : 1;
		if (!width) sx = 1;
		if (!height) sy = 1;
		// Text isn't stretched (its size takes the scale), so its box keeps its proportions. A
		// picture keeps its own too, and Shift lets it stretch, the other way round from shapes.
		if (press.shift !== op.pictures || op.texts) {
			if (left || right) {
				if (top || bottom) {
					const size = Math.max(Math.abs(sx), Math.abs(sy));
					sx = Math.sign(sx || 1) * size;
					sy = Math.sign(sy || 1) * size;
				} else sy = Math.abs(sx);
			} else sx = Math.abs(sy);
		}
		const tiny = 1e-3;
		if (Math.abs(sx) < tiny) sx = Math.sign(sx || 1) * tiny;
		if (Math.abs(sy) < tiny) sy = Math.sign(sy || 1) * tiny;
		const m = multiply(frame.matrix, multiply(scaling(sx, sy, fixedX, fixedY), back));
		studio.live(transformShapes(op.doc, op.selection, m, transformShape), op.selection);
		this.label = {
			x: press.sx + 16,
			y: press.sy + 20,
			text: `${measure(Math.abs(width * sx))} × ${measure(Math.abs(height * sy))}`
		};
	}

	#rotate(op: Extract<Op, { kind: 'rotate' }>, press: Press) {
		const studio = this.#studio;
		let turn = Math.atan2(press.y - op.centre.y, press.x - op.centre.x) - op.from;
		if (press.shift) turn = Math.round((op.base + turn) / SNAP) * SNAP - op.base;
		const m = rotation(turn, op.centre.x, op.centre.y);
		studio.live(transformShapes(op.doc, op.selection, m, transformShape), op.selection);
		let degrees = (((op.base + turn) * 180) / Math.PI) % 360;
		if (degrees > 180) degrees -= 360;
		if (degrees <= -180) degrees += 360;
		this.label = { x: press.sx + 16, y: press.sy + 20, text: `${Math.round(degrees * 10) / 10}°` };
	}

	#end(op: Extract<Op, { kind: 'end' }>, press: Press) {
		const studio = this.#studio;
		const found = locate(op.doc, op.id);
		if (!found || found.shape.kind !== 'line') return;
		const line = found.shape;
		const back = invert(multiply(found.matrix, line.transform));
		if (!back) return;
		let point = apply(back, press.x, press.y);
		const other = op.end === 1 ? { x: line.x2, y: line.y2 } : { x: line.x1, y: line.y1 };
		if (press.shift) point = snap45(other, point);
		const next: LineShape =
			op.end === 1 ? { ...line, x1: point.x, y1: point.y } : { ...line, x2: point.x, y2: point.y };
		studio.live(
			mapShapes(op.doc, [op.id], () => next),
			op.selection
		);
		const length = Math.hypot(next.x2 - next.x1, next.y2 - next.y1);
		const angle = (-Math.atan2(next.y2 - next.y1, next.x2 - next.x1) * 180) / Math.PI;
		this.label = {
			x: press.sx + 16,
			y: press.sy + 20,
			text: `${measure(length)} · ${Math.round(angle)}°`
		};
	}

	#marquee(op: Extract<Op, { kind: 'marquee' }>, press: Press) {
		const studio = this.#studio;
		op.current = press;
		this.op = { ...op };
		const box = {
			minX: Math.min(op.start.x, press.x),
			minY: Math.min(op.start.y, press.y),
			maxX: Math.max(op.start.x, press.x),
			maxY: Math.max(op.start.y, press.y)
		};
		const touched: string[] = [];
		for (const layer of studio.doc.layers) {
			if (layer.kind !== 'vector' || layer.hidden || layer.locked) continue;
			for (const shape of layer.shapes) {
				if (shape.hidden || shape.locked) continue;
				const bounds = shapeBounds(shape);
				if (bounds && intersects(bounds, box)) touched.push(shape.id);
			}
		}
		studio.select([...op.selection, ...touched.filter((id) => !op.selection.includes(id))]);
	}

	up() {
		const studio = this.#studio;
		const op = this.op;
		this.op = null;
		this.label = null;
		if (!op) return;
		if (op.kind === 'marquee') return;
		if (op.kind === 'move' && !op.moved) {
			// A click on one of several picked shapes picks just that one.
			if (op.clicked && studio.selection.length > 1) studio.select([op.clicked]);
			return;
		}
		studio.settle(op.kind === 'move' ? op.origin : op.doc, op.selection);
	}

	double(press: Press) {
		const studio = this.#studio;
		const hit = shapeAt(studio.doc, press.x, press.y, 5 / studio.view.zoom, true);
		if (!hit) return;
		const outer = shapeAt(studio.doc, press.x, press.y, 5 / studio.view.zoom, false);
		const inGroup = outer && outer.id !== hit.id && studio.selection.includes(outer.id);
		if (inGroup) {
			studio.select([hit.id]);
			return;
		}
		if (hit.kind === 'text') {
			studio.editText(hit.id, 'all');
			return;
		}
		if (hit.kind !== 'group' && studio.selection.includes(hit.id)) {
			studio.toolId = 'direct';
		}
	}

	cancel() {
		const op = this.op;
		if (op && op.kind !== 'marquee') {
			this.#studio.live(op.kind === 'move' ? op.origin : op.doc, op.selection);
			this.op = null;
			this.label = null;
			return true;
		}
		this.op = null;
		if (this.#studio.selection.length) {
			this.#studio.select([]);
			return true;
		}
		return false;
	}

	leave() {
		this.op = null;
		this.grip = null;
		this.label = null;
	}
}
