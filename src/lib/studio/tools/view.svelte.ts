// Getting around: the hand (H, or hold Space) drags the view; the zoom (Z) zooms in where it's
// clicked (out with Alt), or to fit a box dragged round part of the drawing.

import type { Studio } from '../studio.svelte';
import { noChrome, type Chrome, type Press, type Tool } from './tool';

export class HandTool implements Tool {
	#studio: Studio;
	#last: Press | null = null;
	grabbing = $state(false);
	chrome = noChrome();

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	get cursor() {
		return this.grabbing ? 'grabbing' : 'grab';
	}

	down(press: Press) {
		this.#last = press;
		this.grabbing = true;
	}

	move(press: Press, pressed: boolean) {
		if (!pressed || !this.#last) return;
		this.#studio.pan(press.sx - this.#last.sx, press.sy - this.#last.sy);
		this.#last = press;
	}

	up() {
		this.#last = null;
		this.grabbing = false;
	}

	cancel() {
		return false;
	}
}

export class ZoomTool implements Tool {
	#studio: Studio;
	#start: Press | null = null;
	box = $state.raw<Chrome['marquee']>(null);
	alt = $state(false);

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	get cursor() {
		return this.alt ? 'zoom-out' : 'zoom-in';
	}

	get chrome() {
		const chrome = noChrome();
		chrome.marquee = this.box;
		return chrome;
	}

	down(press: Press) {
		this.#start = press;
	}

	move(press: Press, pressed: boolean) {
		this.alt = press.alt;
		const start = this.#start;
		if (!pressed || !start) return;
		this.box = {
			x: Math.min(start.sx, press.sx),
			y: Math.min(start.sy, press.sy),
			width: Math.abs(press.sx - start.sx),
			height: Math.abs(press.sy - start.sy)
		};
	}

	up(press: Press) {
		const start = this.#start;
		this.#start = null;
		this.box = null;
		if (!start) return;
		const studio = this.#studio;
		if (Math.hypot(press.sx - start.sx, press.sy - start.sy) > 8) {
			studio.fit(
				{
					minX: Math.min(start.x, press.x),
					minY: Math.min(start.y, press.y),
					maxX: Math.max(start.x, press.x),
					maxY: Math.max(start.y, press.y)
				},
				16
			);
			return;
		}
		studio.zoomBy(press.alt ? 0.5 : 2, press.sx, press.sy);
	}

	cancel() {
		const busy = !!this.#start;
		this.#start = null;
		this.box = null;
		return busy;
	}
}
