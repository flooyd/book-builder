// The text tool (T): click to start a line of text there and type; Enter starts another line. Click
// a text to type into it, the caret where it was clicked. Esc, or a click away, finishes it, and
// it's back to the select tool with the text picked, ready to move or resize (resizing changes its
// size). The typing itself happens in the stage's TextEditor, a textarea over the drawing.

import { locate } from '../edit';
import { apply, invert, multiply } from '../geometry';
import { shapeAt } from '../render';
import type { Studio } from '../studio.svelte';
import { caretAt } from '../text';
import { screenOutline } from './marks';
import { noChrome, type Chrome, type Press, type Tool } from './tool';

export class TextTool implements Tool {
	#studio: Studio;
	hoverId = $state<string | null>(null);

	constructor(studio: Studio) {
		this.#studio = studio;
	}

	cursor = 'text';

	get chrome(): Chrome {
		const studio = this.#studio;
		const view = studio.viewMatrix();
		const chrome = noChrome();
		const typing = studio.typing?.id ?? null;
		if (this.hoverId && this.hoverId !== typing) {
			const d = screenOutline(studio.doc, this.hoverId, view);
			if (d) chrome.paths.push({ d, kind: 'hover' });
		}
		if (typing) {
			const d = screenOutline(studio.doc, typing, view);
			if (d) chrome.paths.push({ d, kind: 'selected' });
		}
		return chrome;
	}

	/** A text under the pointer, to type into. */
	#textAt(press: Press) {
		const studio = this.#studio;
		const hit = shapeAt(studio.doc, press.x, press.y, 5 / studio.view.zoom, true);
		return hit?.kind === 'text' ? hit : null;
	}

	down(press: Press) {
		const studio = this.#studio;
		const text = this.#textAt(press);
		if (!text) {
			studio.addText(press.x, press.y);
			return;
		}
		const found = locate(studio.doc, text.id);
		const back = found && invert(multiply(found.matrix, text.transform));
		const local = back ? apply(back, press.x, press.y) : { x: 0, y: 0 };
		studio.editText(text.id, caretAt(text, local.x, local.y));
	}

	move(press: Press, pressed: boolean) {
		if (!pressed) this.hoverId = this.#textAt(press)?.id ?? null;
	}

	up() {}

	cancel() {
		if (!this.#studio.typing) return false;
		this.#studio.endTyping();
		this.#studio.toolId = 'select';
		return true;
	}

	leave() {
		this.hoverId = null;
		this.#studio.endTyping();
	}
}
