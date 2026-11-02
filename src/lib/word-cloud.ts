// Lays out a word cloud: each word as close to the middle as it will go, biggest first, so the words
// that matter most sit at the heart of it. Words stay level, because a cloud is there to be read.
// No imports and no randomness, so the same words always land in the same places.

export type CloudWord = {
	key: string;
	text: string;
	weight: number;
	/** Keeps its place in the cloud however light it is. */
	pinned?: boolean;
};

export type Placed = {
	/** Its centre, from the top left of the cloud. */
	x: number;
	y: number;
	size: number;
};

export type Cloud<Word extends CloudWord = CloudWord> = {
	width: number;
	height: number;
	words: (Word & Placed)[];
};

/** How wide some text is at this size, as drawn in the real font. */
export type Measure = (text: string, size: number) => number;

/** Wider than tall on a desk, roughly square on a phone. */
const aspectOf = (width: number) =>
	width >= 1000 ? 2.1 : width >= 640 ? 1.6 : width >= 480 ? 1.4 : 1.05;

/** Room for a word, in pixels of cloud at this width, so a phone shows fewer. */
const roomPerWord = (width: number) => (width >= 720 ? 3400 : 2600);

const FEWEST_WORDS = 24;
/** How much of the space the words fill, leaving the gaps a cloud needs. */
const FILL = 0.5;
/** Letters sit inside their line height, so a box this tall still looks clear of the next word. */
const BOX_HEIGHT = 0.92;
const GAP = 3;
/** How tightly the spiral winds, and how far it goes looking before giving a word up. */
const SPIRAL_STEP = 0.11;
const SPIRAL_GROWTH = 0.62;
const SPIRAL_STEPS = 9000;
/** Starts each word at a new angle, so they fan out instead of stacking along one arm. */
const GOLDEN_ANGLE = 2.39996;

type Box = { left: number; right: number; top: number; bottom: number };

const overlaps = (a: Box, b: Box) =>
	a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Sizes by area: a word used four times as often takes up four times the space, not sixteen. */
function sizesOf(words: CloudWord[], width: number, measure: Measure) {
	const largest = Math.min(110, Math.max(44, width * 0.105));
	const smallest = Math.min(17, Math.max(12.5, width * 0.0155));
	const top = words[0]?.weight ?? 1;
	const sizes = words.map((word) => Math.max(smallest, largest * Math.sqrt(word.weight / top)));

	// A short list of words all used about as often would otherwise be enormous.
	const target = (width * width * FILL) / aspectOf(width);
	const used = words.reduce((sum, word, index) => {
		const size = sizes[index];
		return sum + measure(word.text, size) * size;
	}, 0);
	const scale = used > target ? Math.sqrt(target / used) : 1;
	return sizes.map((size) => Math.max(smallest, size * scale));
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/** The word an arrow key lands on: the nearest that way, favouring what lies straight ahead. */
export function nextWord<Word extends Placed>(words: Word[], from: number, direction: Direction) {
	const start = words[from];
	if (!start) return undefined;
	const sideways = direction === 'left' || direction === 'right';
	const forward = direction === 'right' || direction === 'down' ? 1 : -1;
	let best: Word | undefined;
	let bestScore = Infinity;
	for (const word of words) {
		const ahead = (sideways ? word.x - start.x : word.y - start.y) * forward;
		const across = Math.abs(sideways ? word.y - start.y : word.x - start.x);
		if (word === start || ahead <= 0) continue;
		const score = ahead + across * 2.5;
		if (score < bestScore) {
			best = word;
			bestScore = score;
		}
	}
	return best;
}

/** The word nearest a point, if one is within reach of it. */
export function wordNear<Word extends Placed & { text: string }>(
	words: Word[],
	x: number,
	y: number,
	reach: number,
	measure: Measure
) {
	let best: Word | undefined;
	let bestDistance = reach;
	for (const word of words) {
		const across = Math.abs(x - word.x) - measure(word.text, word.size) / 2;
		const down = Math.abs(y - word.y) - word.size / 2;
		const distance = Math.hypot(Math.max(across, 0), Math.max(down, 0));
		if (distance <= bestDistance) {
			best = word;
			bestDistance = distance;
		}
	}
	return best;
}

/** Sets out the heaviest words that fit at this width. `words` must be heaviest first. */
export function layOutCloud<Word extends CloudWord>(
	words: Word[],
	width: number,
	measure: Measure
): Cloud<Word> {
	const aspect = aspectOf(width);
	const fits = Math.round((width * (width / aspect)) / roomPerWord(width));
	const room = Math.max(FEWEST_WORDS, fits);
	// Pinned words use up the room first, and the heaviest of the rest fill what's left.
	const pinned = words.filter((word) => word.pinned).length;
	let spare = Math.max(room - pinned, FEWEST_WORDS / 2);
	const chosen = words.filter((word) => word.pinned || spare-- > 0);
	const sizes = sizesOf(chosen, width, measure);

	const boxes: Box[] = [];
	const placed: (Word & Placed)[] = [];
	const middle = width / 2;

	chosen.forEach((word, index) => {
		// A very long word at the top of a short list mustn't run off the edge.
		const widest = (width - GAP * 2) / (measure(word.text, sizes[index]) || 1);
		const size = sizes[index] * Math.min(1, widest);
		const halfWidth = measure(word.text, size) / 2 + GAP;
		const halfHeight = (size * BOX_HEIGHT) / 2 + GAP / 2;
		const phase = index * GOLDEN_ANGLE;

		for (let step = 0; step < SPIRAL_STEPS; step++) {
			const angle = step * SPIRAL_STEP;
			const reach = angle * SPIRAL_GROWTH;
			const x = middle + reach * Math.cos(angle + phase) * aspect;
			const y = reach * Math.sin(angle + phase);
			if (x - halfWidth < 0 || x + halfWidth > width) continue;
			const box = {
				left: x - halfWidth,
				right: x + halfWidth,
				top: y - halfHeight,
				bottom: y + halfHeight
			};
			if (boxes.some((other) => overlaps(box, other))) continue;
			boxes.push(box);
			placed.push({ ...word, x, y, size });
			return;
		}
	});

	if (placed.length === 0) return { width, height: 0, words: [] };

	const top = Math.min(...boxes.map((box) => box.top));
	const bottom = Math.max(...boxes.map((box) => box.bottom));
	return {
		width,
		height: bottom - top,
		words: placed.map((word) => ({ ...word, y: word.y - top }))
	};
}
