// The shape tools: rectangle (R), ellipse (O), polygon, star, line (L) and arrow (Shift+L). Drag to
// draw one; Shift makes it even (a square, a circle, a line at 45°), Alt draws it from the centre.
// A click without a drag makes one 100 pixels across. Then it's back to the select tool, with the
// new shape picked, ready to resize.

import type { Shape } from '$lib/drawing';
import { newId } from '$lib/drawing';
import { translation } from '../geometry';
import type { Studio } from '../studio.svelte';
import { crossCursor, measure, noChrome, snap45, type Chrome, type Press, type Tool } from './tool';

export type ShapeToolKind = 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'arrow';

/** Settings for the next polygon or star, which the inspector shows while drawing them. */
export const shapeDefaults = $state({ sides: 6, points: 5, inner: 0.45, radius: 0 });

export class ShapeTool implements Tool {
	#studio: Studio;
	#kind: ShapeToolKind;
	#start: Press | null = null;
	label = $state.raw<Chrome['label']>(null);

	constructor(studio: Studio, kind: ShapeToolKind) {
		this.#studio = studio;
		this.#kind = kind;
	}

	cursor = crossCursor;

	get chrome() {
		const chrome = noChrome();
		chrome.label = this.label;
		return chrome;
	}

	/** The shape from a press to a point. */
	#shape(start: Press, end: Press, click: boolean): Shape {
		const studio = this.#studio;
		const paint = studio.newPaint();
		const base = { id: newId(), name: '', opacity: 1, hidden: false, locked: false };
		const kind = this.#kind;
		if (kind === 'line' || kind === 'arrow') {
			let to = { x: end.x, y: end.y };
			if (click) to = { x: start.x + 100, y: start.y };
			else if (end.shift) to = snap45(start, to);
			let from = { x: start.x, y: start.y };
			if (end.alt && !click) from = { x: start.x * 2 - to.x, y: start.y * 2 - to.y };
			const color = studio.style.stroke ?? studio.style.fill ?? '#1d2142ff';
			return {
				...base,
				kind: 'line',
				transform: translation(from.x, from.y),
				x1: 0,
				y1: 0,
				x2: to.x - from.x,
				y2: to.y - from.y,
				stroke: studio.strokeOf(color, studio.style.strokeWidth || 4),
				start: 'none',
				end: kind === 'arrow' ? 'arrow' : 'none'
			};
		}
		let width = click ? 100 : end.x - start.x;
		let height = click ? 100 : end.y - start.y;
		if (end.shift && !click) {
			const size = Math.max(Math.abs(width), Math.abs(height));
			width = Math.sign(width || 1) * size;
			height = Math.sign(height || 1) * size;
		}
		let left = width < 0 ? start.x + width : start.x;
		let top = height < 0 ? start.y + height : start.y;
		if (click) {
			left = start.x - 50;
			top = start.y - 50;
		} else if (end.alt) {
			left = start.x - Math.abs(width);
			top = start.y - Math.abs(height);
			width *= 2;
			height *= 2;
		}
		const box = {
			...base,
			...paint,
			transform: translation(left, top),
			width: Math.max(1, Math.abs(width)),
			height: Math.max(1, Math.abs(height))
		};
		switch (kind) {
			case 'rect':
				return { ...box, kind: 'rect', radius: shapeDefaults.radius };
			case 'ellipse':
				return { ...box, kind: 'ellipse' };
			case 'polygon':
				return { ...box, kind: 'polygon', sides: shapeDefaults.sides };
			case 'star':
				return { ...box, kind: 'star', points: shapeDefaults.points, inner: shapeDefaults.inner };
		}
	}

	down(press: Press) {
		this.#start = press;
		this.#studio.select([]);
	}

	move(press: Press, pressed: boolean) {
		const start = this.#start;
		if (!pressed || !start) return;
		const shape = this.#shape(start, press, false);
		this.#studio.sketch = shape;
		const size =
			shape.kind === 'line'
				? `${measure(Math.hypot(shape.x2, shape.y2))}`
				: shape.kind !== 'group' && shape.kind !== 'path' && shape.kind !== 'text'
					? `${measure(shape.width)} × ${measure(shape.height)}`
					: '';
		this.label = { x: press.sx + 16, y: press.sy + 20, text: size };
	}

	up(press: Press) {
		const start = this.#start;
		this.#start = null;
		this.label = null;
		this.#studio.sketch = null;
		if (!start) return;
		const click = Math.hypot(press.sx - start.sx, press.sy - start.sy) < 4;
		this.#studio.addShape(this.#shape(start, press, click));
		this.#studio.toolId = 'select';
	}

	cancel() {
		if (!this.#start) return false;
		this.#start = null;
		this.label = null;
		this.#studio.sketch = null;
		return true;
	}

	leave() {
		this.cancel();
	}
}
