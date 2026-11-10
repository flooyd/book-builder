// The pencil (N): draw freely, and the line becomes a few smooth curves, a path like any other to
// edit point by point. Ending near where it began closes it, and a closed one takes the fill.
// How steady the line is comes from the smoothing setting.

import { newId, type Anchor, type PathShape } from '$lib/drawing';
import { IDENTITY } from '$lib/drawing';
import { fitAnchors, steady, type Point } from '../fit';
import type { Studio } from '../studio.svelte';
import { noChrome, pencilCursor, type Press, type Tool } from './tool';

/** 0 is the line as drawn, 1 very steady. */
export const pencilSettings = $state({ smoothing: 0.5 });

export class PencilTool implements Tool {
	#studio: Studio;
	#points: Point[] = [];
	#start: Press | null = null;

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	cursor = pencilCursor;
	chrome = noChrome();

	#path(anchors: Anchor[], closed: boolean): PathShape {
		const studio = this.#studio;
		const color = studio.style.stroke ?? studio.style.fill ?? '#1d2142ff';
		return {
			id: newId(),
			name: '',
			kind: 'path',
			transform: [...IDENTITY],
			opacity: 1,
			hidden: false,
			locked: false,
			paths: [{ closed, anchors }],
			fill: closed && studio.style.fill && studio.style.stroke ? studio.newPaint().fill : null,
			stroke: studio.strokeOf(color, studio.style.strokeWidth || 2),
			fillRule: 'nonzero'
		};
	}

	down(press: Press) {
		this.#start = press;
		this.#points = [{ x: press.x, y: press.y }];
	}

	move(_press: Press, pressed: boolean, steps: Press[]) {
		if (!pressed || !this.#start) return;
		for (const step of steps) this.#points.push({ x: step.x, y: step.y });
		const anchors = this.#points.map((point): Anchor => [
			point.x,
			point.y,
			point.x,
			point.y,
			point.x,
			point.y,
			0
		]);
		this.#studio.sketch = this.#path(anchors, false);
	}

	up() {
		const start = this.#start;
		this.#start = null;
		this.#studio.sketch = null;
		if (!start) return;
		const zoom = this.#studio.view.zoom;
		const points = steady(this.#points, pencilSettings.smoothing);
		this.#points = [];
		const travelled = points.reduce(
			(sum, point, index) =>
				index ? sum + Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y) : 0,
			0
		);
		// A click leaves no line.
		if (travelled * zoom < 3) return;
		const end = points[points.length - 1];
		const closed =
			points.length > 8 &&
			travelled * zoom > 40 &&
			Math.hypot(end.x - start.x, end.y - start.y) * zoom < 12;
		// Fitting misses by at most a pixel and a half on screen, at any zoom.
		const tolerance = (1 + pencilSettings.smoothing * 2) / zoom;
		let anchors = fitAnchors(
			closed ? [...points.slice(0, -1), { x: start.x, y: start.y }] : points,
			tolerance
		);
		if (closed && anchors.length > 2) {
			// The last point sits on the first: fold it in, keeping its handle.
			const last = anchors[anchors.length - 1];
			const first = anchors[0];
			anchors = [
				[first[0], first[1], last[2], last[3], first[4], first[5], 1],
				...anchors.slice(1, -1)
			];
		}
		if (anchors.length < 2) return;
		this.#studio.addShape(this.#path(anchors, closed && anchors.length > 2));
	}

	cancel() {
		if (!this.#start) return false;
		this.#start = null;
		this.#points = [];
		this.#studio.sketch = null;
		return true;
	}

	leave() {
		this.cancel();
	}
}
