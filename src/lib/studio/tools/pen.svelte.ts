// The pen (P): click for a corner, drag for a curve (Alt while dragging moves only the handle
// ahead, for a sharp turn; Shift keeps lines and handles to 45°). Click the first point to close
// the path; Enter or Esc ends an open one; Backspace takes back the last point.
//
// On a picked path, the pen also edits: over a segment it adds a point (+), over a point it takes
// it away (−).

import { IDENTITY, newId, type Anchor, type PathShape } from '$lib/drawing';
import { locate, mapShapes } from '../edit';
import { apply, corner, invert, multiply, pathData, transformSubpaths } from '../geometry';
import type { Studio } from '../studio.svelte';
import { insertAnchor, nearestAnchor, nearestSegment, removeAnchors } from './path-edit';
import { noChrome, penCursor, snap45, type Chrome, type Press, type Tool } from './tool';

type Hover =
	| { kind: 'close' }
	| { kind: 'add'; id: string; path: number; segment: number; t: number }
	| { kind: 'remove'; id: string; path: number; index: number }
	| null;

export class PenTool implements Tool {
	#studio: Studio;
	/** The path being drawn, in the drawing's coordinates. */
	anchors = $state.raw<Anchor[]>([]);
	#dragging: 'last' | 'first' | null = null;
	#closing = false;
	pointer = $state.raw<Press | null>(null);
	hover = $state.raw<Hover>(null);

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	get cursor() {
		const hover = this.hover;
		if (hover?.kind === 'close') return penCursor('o');
		if (hover?.kind === 'add') return penCursor('+');
		if (hover?.kind === 'remove') return penCursor('-');
		return penCursor(this.anchors.length ? '' : 'x');
	}

	get chrome(): Chrome {
		const chrome = noChrome();
		const studio = this.#studio;
		const view = studio.viewMatrix();
		const anchors = this.anchors;
		// The picked paths, to show where a click would add or take away a point.
		if (!anchors.length) {
			for (const id of studio.selection) {
				const found = locate(studio.doc, id);
				if (found?.shape.kind !== 'path') continue;
				const m = multiply(view, multiply(found.matrix, found.shape.transform));
				const paths = transformSubpaths(found.shape.paths, m);
				chrome.paths.push({ d: pathData(paths), kind: 'selected' });
				for (const path of paths)
					for (const anchor of path.anchors)
						chrome.anchors.push({ x: anchor[0], y: anchor[1], selected: false });
			}
			return chrome;
		}
		const screen = transformSubpaths([{ closed: false, anchors }], view)[0].anchors;
		screen.forEach((anchor, index) =>
			chrome.anchors.push({
				x: anchor[0],
				y: anchor[1],
				selected: index === screen.length - 1,
				first: index === 0
			})
		);
		const last = screen[screen.length - 1];
		for (const [x, y] of [
			[last[2], last[3]],
			[last[4], last[5]]
		]) {
			if (x !== last[0] || y !== last[1]) chrome.handles.push({ x, y, ax: last[0], ay: last[1] });
		}
		// The next segment, following the pointer.
		const pointer = this.pointer;
		if (pointer && !this.#dragging) {
			const lastAnchor = anchors[anchors.length - 1];
			let to = { x: pointer.x, y: pointer.y };
			const first = anchors[0];
			if (this.hover?.kind === 'close') to = { x: first[0], y: first[1] };
			else if (pointer.shift) to = snap45({ x: lastAnchor[0], y: lastAnchor[1] }, to);
			const into: Anchor = this.hover?.kind === 'close' ? first : corner(to.x, to.y);
			const preview = transformSubpaths([{ closed: false, anchors: [lastAnchor, into] }], view);
			chrome.paths.push({ d: pathData(preview), kind: 'preview' });
		}
		return chrome;
	}

	/** The path as a shape, for the stage to show while it's drawn and to add when it's done. */
	#shape(closed: boolean): PathShape {
		const studio = this.#studio;
		const color = studio.style.stroke ?? studio.style.fill ?? '#1d2142ff';
		const paint = studio.newPaint();
		return {
			id: newId(),
			name: '',
			kind: 'path',
			transform: [...IDENTITY],
			opacity: 1,
			hidden: false,
			locked: false,
			paths: [{ closed, anchors: this.anchors }],
			fill: closed ? paint.fill : null,
			stroke: studio.strokeOf(color, studio.style.strokeWidth || 2),
			fillRule: 'nonzero'
		};
	}

	#show() {
		this.#studio.sketch = this.anchors.length ? this.#shape(false) : null;
	}

	#reach() {
		return 7 / this.#studio.view.zoom;
	}

	#hoverAt(press: Press): Hover {
		const anchors = this.anchors;
		const reach = this.#reach();
		if (anchors.length >= 2) {
			const [x, y] = anchors[0];
			if (Math.hypot(x - press.x, y - press.y) <= reach) return { kind: 'close' };
		}
		if (anchors.length) return null;
		const studio = this.#studio;
		for (const id of studio.selection) {
			const found = locate(studio.doc, id);
			if (found?.shape.kind !== 'path') continue;
			const back = invert(multiply(found.matrix, found.shape.transform));
			if (!back) continue;
			const local = apply(back, press.x, press.y);
			const point = nearestAnchor(found.shape.paths, local.x, local.y, reach);
			if (point) return { kind: 'remove', id, path: point.path, index: point.index };
			const segment = nearestSegment(found.shape.paths, local.x, local.y, reach);
			if (segment)
				return { kind: 'add', id, path: segment.path, segment: segment.segment, t: segment.t };
		}
		return null;
	}

	down(press: Press) {
		const studio = this.#studio;
		const hover = this.#hoverAt(press);
		if (hover?.kind === 'add' || hover?.kind === 'remove') {
			const next = mapShapes(studio.doc, [hover.id], (shape) => {
				if (shape.kind !== 'path') return shape;
				const paths =
					hover.kind === 'add'
						? insertAnchor(shape.paths, hover.path, hover.segment, hover.t)
						: removeAnchors(shape.paths, [`${hover.path}:${hover.index}`]);
				return paths.length ? { ...shape, paths } : null;
			});
			studio.apply(
				next,
				studio.selection.filter((id) => locate(next, id))
			);
			this.hover = this.#hoverAt(press);
			return;
		}
		if (hover?.kind === 'close') {
			this.#closing = true;
			this.#dragging = 'first';
			return;
		}
		if (!this.anchors.length) studio.select([]);
		let point = { x: press.x, y: press.y };
		const last = this.anchors.at(-1);
		if (last && press.shift) point = snap45({ x: last[0], y: last[1] }, point);
		this.anchors = [...this.anchors, corner(point.x, point.y)];
		this.#dragging = 'last';
		this.#show();
	}

	move(press: Press, pressed: boolean) {
		this.pointer = press;
		if (!pressed || !this.#dragging) {
			this.hover = this.#hoverAt(press);
			return;
		}
		const index = this.#dragging === 'first' ? 0 : this.anchors.length - 1;
		const anchor = this.anchors[index];
		if (!anchor) return;
		const [x, y] = anchor;
		let handle = { x: press.x, y: press.y };
		if (press.shift) handle = snap45({ x, y }, handle);
		if (Math.hypot(handle.x - x, handle.y - y) * this.#studio.view.zoom < 2) return;
		// The drag sets the handle ahead; the one behind mirrors it, unless Alt breaks them apart.
		const next: Anchor = press.alt
			? [x, y, anchor[2], anchor[3], handle.x, handle.y, 0]
			: [x, y, x * 2 - handle.x, y * 2 - handle.y, handle.x, handle.y, 2];
		const anchors = [...this.anchors];
		anchors[index] = next;
		this.anchors = anchors;
		this.#show();
	}

	up() {
		this.#dragging = null;
		if (this.#closing) {
			this.#closing = false;
			this.#end(true);
		}
	}

	/** Adds the path to the drawing (if it's more than a point) and starts afresh. */
	#end(closed: boolean) {
		const anchors = this.anchors;
		this.#studio.sketch = null;
		if (anchors.length >= 2) {
			const shape = this.#shape(closed && anchors.length > 2);
			this.anchors = [];
			this.#studio.addShape(shape);
		} else {
			this.anchors = [];
		}
		this.hover = null;
	}

	finish() {
		if (!this.anchors.length) return false;
		this.#end(false);
		return true;
	}

	cancel() {
		return this.finish();
	}

	key(event: KeyboardEvent) {
		if ((event.key === 'Backspace' || event.key === 'Delete') && this.anchors.length) {
			this.anchors = this.anchors.slice(0, -1);
			this.#show();
			return true;
		}
		return false;
	}

	leave() {
		this.finish();
		this.pointer = null;
		this.hover = null;
	}
}
