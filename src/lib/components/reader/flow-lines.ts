// Book view: where the lines of a flow with footnotes fall, for sliceFlow (book-layout.ts) to cut
// into pages. Browser only: it reads copies laid out as one long column in BookView's hidden
// measuring box, which are the same width and type as the pages, so every position holds there.

import type { FlowLine, NoteLine, Span } from './book-layout';

/** An element holds blocks (a list, a quote, the text itself) rather than lines of its own. */
function holdsBlocks(element: Element) {
	for (const child of element.children) {
		const display = getComputedStyle(child).display;
		if (display !== 'none' && display !== 'contents' && !display.startsWith('inline')) return true;
	}
	return false;
}

/**
 * An element's lines, from where its words fall. Each runs from halfway to the line above to
 * halfway to the line below, which is where one line box meets the next: a page cut there cuts
 * no letters. A footnote's number is left out, since it's raised above its line.
 */
function linesIn(element: HTMLElement, origin: number): Span[] {
	const box = element.getBoundingClientRect();
	const rects: DOMRect[] = [];
	const range = document.createRange();
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.textContent?.trim() || node.parentElement?.closest('.bb-fn-ref')) continue;
		range.selectNodeContents(node);
		for (const rect of range.getClientRects()) if (rect.height > 0) rects.push(rect);
	}
	rects.sort((a, b) => a.top - b.top);
	// Pieces of text whose middles are level with a line are on that line.
	const found: Span[] = [];
	for (const rect of rects) {
		const last = found.at(-1);
		if (last && (rect.top + rect.bottom) / 2 < last.bottom) {
			last.top = Math.min(last.top, rect.top);
			last.bottom = Math.max(last.bottom, rect.bottom);
		} else {
			found.push({ top: rect.top, bottom: rect.bottom });
		}
	}
	if (!found.length) return [{ top: box.top - origin, bottom: box.bottom - origin }];
	return found.map((line, index) => ({
		top: (index === 0 ? box.top : (found[index - 1].bottom + line.top) / 2) - origin,
		bottom:
			(index === found.length - 1 ? box.bottom : (line.bottom + found[index + 1].top) / 2) - origin
	}));
}

/** The lines of a flow's text, top to bottom, with the footnotes whose numbers are on each. */
export function flowLines(flow: HTMLElement): FlowLine[] {
	const origin = flow.getBoundingClientRect().top;
	const lines: FlowLine[] = [];
	const walk = (parent: Element) => {
		for (const child of parent.children) {
			if (!(child instanceof HTMLElement) || child.matches('.bb-notes')) continue;
			if (getComputedStyle(child).display === 'none') continue;
			if (child.matches('header, h1, h2, h3, h4, h5, h6, hr, figure')) {
				const box = child.getBoundingClientRect();
				lines.push({
					top: box.top - origin,
					bottom: box.bottom - origin,
					notes: [],
					// A title or a heading stays with what follows it.
					breakAfter: child.tagName === 'HR' || child.tagName === 'FIGURE',
					// A picture with a page to itself.
					alone: child.matches('.bb-picture-page')
				});
			} else if (holdsBlocks(child)) {
				walk(child);
			} else {
				const own = linesIn(child, origin);
				own.forEach((line, index) => {
					const before = index + 1;
					const left = own.length - before;
					// No paragraph leaves one line alone at a page's foot or head, as in the columns
					// (orphans and widows of 2).
					lines.push({ ...line, notes: [], breakAfter: left === 0 || (before >= 2 && left >= 2) });
				});
			}
		}
	};
	walk(flow);
	// Each number goes with the line it's in: the one its middle is in, or nearest to.
	for (const ref of flow.querySelectorAll<HTMLElement>('.bb-fn-ref')) {
		const number = Number(ref.dataset.note);
		if (!Number.isInteger(number) || number < 1) continue;
		const rect = ref.getBoundingClientRect();
		const middle = (rect.top + rect.bottom) / 2 - origin;
		let nearest: FlowLine | null = null;
		let distance = Infinity;
		for (const line of lines) {
			const away = Math.max(line.top - middle, middle - line.bottom, 0);
			if (away < distance) {
				nearest = line;
				distance = away;
			}
		}
		if (nearest && !nearest.notes.includes(number)) nearest.notes.push(number);
	}
	for (const line of lines) line.notes.sort((a, b) => a - b);
	return lines;
}

/** The lines of a flow's notes, set on their own, note 1 first. */
export function noteLines(flow: HTMLElement): NoteLine[] {
	const origin = flow.getBoundingClientRect().top;
	const lines: NoteLine[] = [];
	for (const item of flow.querySelectorAll<HTMLElement>('.bb-notes li[data-note]')) {
		const note = Number(item.dataset.note);
		for (const line of linesIn(item, origin)) lines.push({ ...line, note });
	}
	return lines;
}
