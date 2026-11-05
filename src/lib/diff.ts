/**
 * Comparing two versions of story text for the version history: paragraph by paragraph, then word
 * by word inside a paragraph that changed. Works on plain text, one paragraph per line, as
 * `plainText` in $lib/rich gives it. Pure and with no imports, so it can be tested on its own,
 * and it runs in the browser so the server never has to.
 */

export type Piece = { kind: 'same' | 'added' | 'removed'; text: string };

/** A paragraph that stayed, came, went, or changed (with its words marked). */
export type Block =
	{ kind: 'same' | 'added' | 'removed'; text: string } | { kind: 'changed'; pieces: Piece[] };

type Step = { kind: Piece['kind']; text: string };

/**
 * The most edits a comparison looks for before giving up on the smallest change: past it (most
 * of a long chapter rewritten at once), the middle is shown as all gone and all new.
 */
const MAX_EDITS = 1200;

/** How alike two paragraphs must be (shared words, 0 to 1) to show as one paragraph changed. */
const ALIKE = 0.4;

/** How many new paragraphs to look through for one like a paragraph that went. */
const LOOK_AHEAD = 6;

const same = (text: string): Step => ({ kind: 'same', text });
const removed = (text: string): Step => ({ kind: 'removed', text });
const added = (text: string): Step => ({ kind: 'added', text });

/**
 * The shortest list of steps from `a` to `b`. The ends both share are matched first, then Myers'
 * algorithm finds the fewest edits in between, which is quick when the change is small whatever
 * the length.
 */
function steps(a: string[], b: string[]): Step[] {
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) start++;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
	}
	const midA = a.slice(start, endA);
	const midB = b.slice(start, endB);
	const middle = fewestEdits(midA, midB) ?? [...midA.map(removed), ...midB.map(added)];
	return [...a.slice(0, start).map(same), ...middle, ...a.slice(endA).map(same)];
}

/**
 * Myers' O(ND) difference algorithm. Each round reaches one edit further along every diagonal;
 * a copy of the furthest points is kept per round to walk the path back. Null past MAX_EDITS.
 */
function fewestEdits(a: string[], b: string[]): Step[] | null {
	const n = a.length;
	const m = b.length;
	if (n === 0 || m === 0) return [...a.map(removed), ...b.map(added)];
	const limit = Math.min(n + m, MAX_EDITS);
	const offset = limit + 1;
	// furthest[k + offset]: how far along `a` the path on diagonal k (x - y) has reached.
	const furthest = new Int32Array(2 * offset + 1);
	// rounds[d]: the furthest points before round d, for diagonals -d - 1 to d + 1.
	const rounds: Int32Array[] = [];
	for (let d = 0; d <= limit; d++) {
		rounds.push(furthest.slice(offset - d - 1, offset + d + 2));
		for (let k = -d; k <= d; k += 2) {
			const down = k === -d || (k !== d && furthest[offset + k - 1] < furthest[offset + k + 1]);
			let x = down ? furthest[offset + k + 1] : furthest[offset + k - 1] + 1;
			let y = x - k;
			while (x < n && y < m && a[x] === b[y]) {
				x++;
				y++;
			}
			furthest[offset + k] = x;
			if (x >= n && y >= m) return walkBack(a, b, rounds);
		}
	}
	return null;
}

function walkBack(a: string[], b: string[], rounds: Int32Array[]): Step[] {
	const out: Step[] = [];
	let x = a.length;
	let y = b.length;
	for (let d = rounds.length - 1; d >= 0; d--) {
		const before = rounds[d];
		const at = (k: number) => before[k + d + 1];
		const k = x - y;
		const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
		const fromK = down ? k + 1 : k - 1;
		const fromX = at(fromK);
		const fromY = fromX - fromK;
		while (x > fromX && y > fromY) {
			out.push(same(a[--x]));
			y--;
		}
		if (d > 0) {
			if (x === fromX) out.push(added(b[--y]));
			else out.push(removed(a[--x]));
		}
	}
	return out.reverse();
}

const WORD = /[\p{L}\p{N}\p{M}]+(?:['’-][\p{L}\p{N}\p{M}]+)*/gu;

/** Words, runs of space, and single marks, which together spell the text again. */
const tokens = (text: string) =>
	text.match(/[\p{L}\p{N}\p{M}]+(?:['’-][\p{L}\p{N}\p{M}]+)*|\s+|[^\s\p{L}\p{N}\p{M}]/gu) ?? [];

const wordsOf = (text: string) => (text.match(WORD) ?? []).map((word) => word.toLowerCase());

/** How alike two paragraphs are: the share of their words they have in common, 0 to 1. */
export function likeness(a: string, b: string) {
	const left = wordsOf(a);
	const right = wordsOf(b);
	if (left.length + right.length === 0) return 1;
	const counts: Record<string, number> = {};
	for (const word of left) counts[word] = (counts[word] ?? 0) + 1;
	let shared = 0;
	for (const word of right) {
		if (counts[word]) {
			counts[word]--;
			shared++;
		}
	}
	return (2 * shared) / (left.length + right.length);
}

/**
 * One paragraph's change, word by word. The spaces between two changed words join the change, so
 * "the old grey cat" to "the young red cat" reads as one swap, not two with a space between.
 */
export function wordPieces(before: string, after: string): Piece[] {
	const out: Piece[] = [];
	let removed = '';
	let added = '';
	// Whether each side holds anything but the spaces it picked up.
	let removedWords = false;
	let addedWords = false;
	const flush = () => {
		if (removedWords) out.push({ kind: 'removed', text: removed });
		if (addedWords) out.push({ kind: 'added', text: added });
		removed = added = '';
		removedWords = addedWords = false;
	};
	const ops = steps(tokens(before), tokens(after));
	ops.forEach((op, index) => {
		if (op.kind === 'removed') {
			removed += op.text;
			removedWords = true;
		} else if (op.kind === 'added') {
			added += op.text;
			addedWords = true;
		} else if (
			(removedWords || addedWords) &&
			/^\s+$/.test(op.text) &&
			index + 1 < ops.length &&
			ops[index + 1].kind !== 'same'
		) {
			removed += op.text;
			added += op.text;
		} else {
			flush();
			const last = out.at(-1);
			if (last?.kind === 'same') last.text += op.text;
			else out.push({ kind: 'same', text: op.text });
		}
	});
	flush();
	return out;
}

const paragraphsOf = (text: string) =>
	text
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean);

/**
 * How `before` became `after`, paragraph by paragraph. A paragraph that went and one that came in
 * its place are shown as one paragraph changed when they're alike enough.
 */
export function diffText(before: string, after: string): Block[] {
	const ops = steps(paragraphsOf(before), paragraphsOf(after));
	const blocks: Block[] = [];
	let index = 0;
	while (index < ops.length) {
		if (ops[index].kind === 'same') {
			blocks.push({ kind: 'same', text: ops[index++].text });
			continue;
		}
		const gone: string[] = [];
		const came: string[] = [];
		while (index < ops.length && ops[index].kind !== 'same') {
			(ops[index].kind === 'removed' ? gone : came).push(ops[index].text);
			index++;
		}
		// Pair each paragraph that went with the next alike one that came, in order.
		let next = 0;
		for (const text of gone) {
			const window = came.slice(next, next + LOOK_AHEAD);
			const found = window.findIndex((other) => likeness(text, other) >= ALIKE);
			const match = found === -1 ? -1 : next + found;
			if (match === -1) {
				blocks.push({ kind: 'removed', text });
				continue;
			}
			for (const other of came.slice(next, match)) blocks.push({ kind: 'added', text: other });
			blocks.push({ kind: 'changed', pieces: wordPieces(text, came[match]) });
			next = match + 1;
		}
		for (const other of came.slice(next)) blocks.push({ kind: 'added', text: other });
	}
	return blocks;
}

/** Words added and taken away across a comparison. */
export function diffCounts(blocks: Block[]) {
	let added = 0;
	let removed = 0;
	const count = (text: string) => text.match(WORD)?.length ?? 0;
	for (const block of blocks) {
		if (block.kind === 'added') added += count(block.text);
		else if (block.kind === 'removed') removed += count(block.text);
		else if (block.kind === 'changed') {
			for (const piece of block.pieces) {
				if (piece.kind === 'added') added += count(piece.text);
				else if (piece.kind === 'removed') removed += count(piece.text);
			}
		}
	}
	return { added, removed };
}
