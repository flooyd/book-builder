import { booksRefresh, chaptersStore, partsStore, type Chapter, type Part } from '$lib/stores';
import { sendJSON, type OutlinePart } from '$lib/library';
import type { ParsedOutline } from '$lib/outline-text';

// The create endpoints answer with an array of the inserted rows.
const first = <T>(rows: T | T[]) => (Array.isArray(rows) ? rows[0] : rows);

/** The arrangement of a book: parts in order, and each chapter-holding part's chapters. */
export type Order = { parts: number[]; chapters: Record<number, number[]> };

export type Kind = 'part' | 'chapter';

/** Section key, as in reading mode's anchors: "part-3", "chapter-12". */
export const keyOf = (kind: Kind, id: number) => `${kind}-${id}`;

export function orderOf(outline: OutlinePart[]): Order {
	return {
		parts: outline.map((entry) => entry.part.id),
		chapters: Object.fromEntries(
			outline
				.filter((entry) => entry.part.hasChapters)
				.map((entry) => [entry.part.id, entry.chapters.map(({ chapter }) => chapter.id)])
		)
	};
}

const sameOrder = (a: Order, b: Order) => JSON.stringify(a) === JSON.stringify(b);

/** Positions (and parts, for chapters) as the order says. Rows the order leaves out are kept. */
export function applyOrder<
	P extends { id: number; position: number },
	C extends { id: number; partId: number; position: number }
>(parts: P[], chapters: C[], order: Order) {
	const partAt: Record<number, number> = {};
	order.parts.forEach((id, position) => (partAt[id] = position));
	const chapterAt: Record<number, { partId: number; position: number }> = {};
	for (const [partId, ids] of Object.entries(order.chapters)) {
		ids.forEach((id, position) => (chapterAt[id] = { partId: Number(partId), position }));
	}
	return {
		parts: parts.map((p) => {
			const position = partAt[p.id];
			return position === undefined || position === p.position ? p : { ...p, position };
		}),
		chapters: chapters.map((c) => {
			const at = chapterAt[c.id];
			return !at || (at.partId === c.partId && at.position === c.position) ? c : { ...c, ...at };
		})
	};
}

/** Where a dragged or keyboard-moved item goes: an index among the parts, or in a part. */
export type Place = { partId?: number; index: number };

export function moveTo(order: Order, kind: Kind, id: number, to: Place): Order {
	if (kind === 'part') {
		const parts = order.parts.filter((p) => p !== id);
		parts.splice(Math.min(to.index, parts.length), 0, id);
		return { ...order, parts };
	}
	const chapters: Record<number, number[]> = {};
	for (const [partId, ids] of Object.entries(order.chapters)) {
		chapters[Number(partId)] = ids.filter((c) => c !== id);
	}
	const list = chapters[to.partId!];
	if (!list) return order;
	list.splice(Math.min(to.index, list.length), 0, id);
	return { ...order, chapters };
}

/**
 * One step up or down (Alt+↑/↓ and the drag handle's arrow keys). A chapter at the edge of its
 * part moves on into the neighbouring part that holds chapters. Null when it can't move.
 */
export function stepMove(order: Order, kind: Kind, id: number, direction: -1 | 1): Order | null {
	if (kind === 'part') {
		const index = order.parts.indexOf(id);
		const to = index + direction;
		return to < 0 || to >= order.parts.length ? null : moveTo(order, kind, id, { index: to });
	}
	const partId = Number(
		Object.entries(order.chapters).find(([, ids]) => ids.includes(id))?.[0] ?? NaN
	);
	const list = order.chapters[partId] ?? [];
	const index = list.indexOf(id);
	if (index + direction >= 0 && index + direction < list.length) {
		return moveTo(order, kind, id, { partId, index: index + direction });
	}
	const holders = order.parts.filter((p) => order.chapters[p]);
	const next = holders[holders.indexOf(partId) + direction];
	if (next === undefined) return null;
	return moveTo(order, kind, id, {
		partId: next,
		index: direction > 0 ? 0 : order.chapters[next].length
	});
}

/**
 * The outline of one book: word counts and casts (loaded from the server), the order while
 * dragging, and every change, saved as it happens. Parts and chapters live in the library stores,
 * so the rest of the app sees changes at once.
 */
export class OutlineDoc {
	readonly bookId: number;
	words = $state<Record<string, number>>({});
	cast = $state<Record<string, number[]>>({});
	loaded = $state(false);
	/** While dragging: the order on screen, saved on drop. */
	draft = $state<Order | null>(null);
	/** Shown as a toast. */
	message = $state<{ text: string; error: boolean } | null>(null);

	#messageTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(bookId: number) {
		this.bookId = bookId;
	}

	async load() {
		try {
			const response = await fetch(`/api/book/${this.bookId}/outline`);
			if (!response.ok) throw new Error(`Request failed (${response.status}).`);
			const data: { words: Record<string, number>; cast: Record<string, number[]> } =
				await response.json();
			this.words = data.words;
			this.cast = data.cast;
			this.loaded = true;
		} catch {
			this.say("Couldn't load word counts and casts.", true);
		}
	}

	say(text: string, error = false) {
		clearTimeout(this.#messageTimer);
		this.message = { text, error };
		this.#messageTimer = setTimeout(() => (this.message = null), error ? 6000 : 3000);
	}

	#fail(error: unknown, fallback: string) {
		this.say(error instanceof Error ? error.message : fallback, true);
	}

	/** Show a new order at once, then save it. On failure the library is reloaded. */
	async commit(order: Order, original: Order) {
		this.draft = null;
		if (sameOrder(order, original)) return true;
		partsStore.update((parts) => applyOrder(parts, [], order).parts);
		chaptersStore.update((chapters) => applyOrder([], chapters, order).chapters);
		try {
			await sendJSON('PUT', `/api/book/${this.bookId}/order`, order);
			return true;
		} catch (error) {
			this.#fail(error, "Couldn't save the new order.");
			booksRefresh.update((n) => n + 1);
			return false;
		}
	}

	async update(kind: Kind, id: number, changes: Record<string, unknown>) {
		try {
			if (kind === 'part') {
				const row = await sendJSON<Part>('PUT', `/api/part/${id}`, changes);
				partsStore.update((parts) => parts.map((p) => (p.id === row.id ? row : p)));
			} else {
				const row = await sendJSON<Chapter>('PUT', `/api/chapter/${id}`, changes);
				chaptersStore.update((chapters) => chapters.map((c) => (c.id === row.id ? row : c)));
			}
			return true;
		} catch (error) {
			this.#fail(error, "Couldn't save the change.");
			return false;
		}
	}

	/**
	 * Add a part (after `after`, or last) or a chapter (in `partId`, after `after`; `after: null`
	 * puts it first). Returns the new row, or null if it failed.
	 */
	async create(
		kind: Kind,
		options: { order: Order; partId?: number; after?: number | null; hasChapters?: boolean }
	): Promise<Part | Chapter | null> {
		const { order, partId, after } = options;
		try {
			let row: Part | Chapter;
			// Where the server puts it (last), and where it was asked for.
			let saved: Order;
			let index: number;
			if (kind === 'part') {
				const hasChapters = options.hasChapters === false ? 0 : 1;
				row = await sendJSON<Part>('POST', '/api/parts', {
					title: hasChapters ? 'Untitled part' : 'Untitled story text',
					bookId: this.bookId,
					hasChapters
				}).then(first);
				partsStore.update((parts) => [...parts, row as Part]);
				saved = {
					parts: [...order.parts, row.id],
					chapters: hasChapters ? { ...order.chapters, [row.id]: [] } : order.chapters
				};
				index =
					after === undefined || after === null
						? order.parts.length
						: order.parts.indexOf(after) + 1;
			} else {
				row = await sendJSON<Chapter>('POST', '/api/chapters', {
					title: 'Untitled chapter',
					partId
				}).then(first);
				chaptersStore.update((chapters) => [...chapters, row as Chapter]);
				const list = order.chapters[partId!] ?? [];
				saved = { ...order, chapters: { ...order.chapters, [partId!]: [...list, row.id] } };
				index = after === undefined ? list.length : after === null ? 0 : list.indexOf(after) + 1;
			}
			await this.commit(moveTo(saved, kind, row.id, { partId, index }), saved);
			return row;
		} catch (error) {
			this.#fail(error, `Couldn't add the ${kind}.`);
			return null;
		}
	}

	async remove(kind: Kind, id: number) {
		try {
			await sendJSON('DELETE', kind === 'part' ? `/api/part/${id}` : `/api/chapter/${id}`);
			if (kind === 'part') {
				partsStore.update((parts) => parts.filter((p) => p.id !== id));
				chaptersStore.update((chapters) => chapters.filter((c) => c.partId !== id));
			} else {
				chaptersStore.update((chapters) => chapters.filter((c) => c.id !== id));
			}
			return true;
		} catch (error) {
			this.#fail(error, `Couldn't delete the ${kind}.`);
			return false;
		}
	}

	async setCast(kind: Kind, id: number, characterIds: number[]) {
		const key = keyOf(kind, id);
		const before = this.cast[key] ?? [];
		this.cast = { ...this.cast, [key]: characterIds };
		try {
			await sendJSON('PUT', `/api/cast/${kind}/${id}`, { characterIds });
		} catch (error) {
			this.cast = { ...this.cast, [key]: before };
			this.#fail(error, "Couldn't save the cast.");
		}
	}

	/** Add a parsed text outline: loose chapters go to the end of `intoPartId`. */
	async import(parsed: ParsedOutline, intoPartId: number | null) {
		try {
			const created = await sendJSON<{ parts: Part[]; chapters: Chapter[] }>(
				'POST',
				`/api/book/${this.bookId}/outline`,
				{ ...parsed, intoPartId }
			);
			partsStore.update((parts) => [...parts, ...created.parts]);
			chaptersStore.update((chapters) => [...chapters, ...created.chapters]);
			return created;
		} catch (error) {
			this.#fail(error, "Couldn't add the outline.");
			return null;
		}
	}
}
