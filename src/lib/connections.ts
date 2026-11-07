// The connections map: the story bible's connections drawn as a web. This sorts each connection
// into a kind by its label and works out where every entry sits. It's pure and needs nothing from
// the browser or the server, so it can be tested on its own.

import type { EntryType } from './bible';

// ---- Kinds of connection --------------------------------------------------------------------

export type RelationKind = 'family' | 'allies' | 'rivals' | 'other';

/** In the order the map's filters and legend show them. */
export const RELATION_KINDS: RelationKind[] = ['family', 'allies', 'rivals', 'other'];

export const RELATION_COPY: Record<RelationKind, { label: string; long: string }> = {
	family: { label: 'Family', long: 'Family' },
	allies: { label: 'Allies', long: 'Friends and allies' },
	rivals: { label: 'Rivals', long: 'Rivals and enemies' },
	other: { label: 'Other', long: 'Every other tie' }
};

const FAMILY =
	/\b(?:sister|brother|sibling|twin|mother|father|mum|mom|mama|dad|papa|parent|son|daughter|child|children|wife|husband|spouse|married|wed|wedded|betrothed|fianc[eé]e?|cousin|aunt|uncle|niece|nephew|grand\w*|step(?:mother|father|sister|brother|son|daughter|parent|child)|half-(?:sister|brother)|heir|heiress|ancestor|descendant|kin|kinsman|kinswoman|family|clan|widow|widower|in-law)\b/;

const RIVALS =
	/\b(?:rival|rivals|enemy|enemies|nemesis|archenemy|foe|adversary|hates?|hated|hunts?|hunted|betray\w*|traitor|oppos\w*|against|war|feud\w*|kill\w*|murder\w*|threat\w*|jealous|resent\w*|distrusts?|blackmail\w*|competes?|competitor|exiled|banished|wronged|cursed|captor|prisoner)\b/;

const ALLIES =
	/\b(?:friend\w*|ally|allies|allied|partner\w*|loves?|loved|lover|beloved|mentor\w*|mentee|student|pupil|apprentice|teacher|protect\w*|guards?|guardian|bodyguard|serves?|served|servant|loyal|sworn|companion|comrade|trusts?|trusted|helps?|saved|rescued|confidant|teammate|crewmate|squire|ward|follower|disciple)\b/;

/**
 * What kind of tie a connection's label describes. The first that fits wins, in this order:
 * family, rivals, allies. So "Estranged sister of" is family and "Sworn enemy of" is a rival.
 * Anything else ("Captain of", "Lives in", "Owes") is another kind of tie.
 */
export function relationKind(label: string): RelationKind {
	const text = label.toLowerCase();
	if (FAMILY.test(text)) return 'family';
	if (RIVALS.test(text)) return 'rivals';
	if (ALLIES.test(text)) return 'allies';
	return 'other';
}

/** Labels offered when connecting two entries, a few of each kind. */
export const LABEL_SUGGESTIONS = [
	'Sister of',
	'Brother of',
	'Parent of',
	'Child of',
	'Married to',
	'Friend of',
	'Mentor of',
	'Loyal to',
	'Rival of',
	'Enemy of',
	'Captain of',
	'Lives in',
	'Member of',
	'Owes'
];

// ---- What the map draws ---------------------------------------------------------------------

/** One entry on the map, keyed "character-12". */
export type MapNode = {
	key: string;
	type: EntryType;
	id: number;
	name: string;
	/** Not in this book or series, but connected to something that is. */
	elsewhere: boolean;
	/** How many connections it has here. */
	degree: number;
};

/** One connection on the map, reading from → to. */
export type MapEdge = {
	id: number;
	from: string;
	to: string;
	label: string;
	kind: RelationKind;
};

export type Point = { x: number; y: number };

// ---- Where everything sits ------------------------------------------------------------------

/** How far apart two connected entries sit when the line between them has no label. */
export const LINK_LENGTH = 170;

/** How long a connection's line wants to be: long enough that its label fits between the two. */
export const linkLength = (label: string) =>
	Math.min(340, Math.max(LINK_LENGTH, label.trim().length * 7.2 + 120));

/** The golden angle, which spreads points around a spiral without lining them up. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** The size of an entry's circle on the map: a little bigger for each connection, up to a point. */
export const nodeRadius = (degree: number) => 25 + Math.min(degree, 8) * 1.5;

/**
 * Where each entry sits on the web, by a force layout: every entry pushes the others away, every
 * connection pulls its two ends towards its own length, and a weak pull to the middle keeps the
 * whole thing together. It's worked out in one go, with no randomness, so the same web always
 * comes out the same.
 *
 * Entries in `placed` stay where they are, and only the rest find a place among them, so adding a
 * connection or an entry doesn't shuffle a web the writer has arranged.
 */
export function layoutWeb(
	keys: string[],
	links: { from: string; to: string; length: number }[],
	placed: Record<string, Point> = {}
): Record<string, Point> {
	const index: Record<string, number> = {};
	keys.forEach((key, i) => (index[key] = i));
	const valid = links.filter(
		(link) =>
			index[link.from] !== undefined && index[link.to] !== undefined && link.from !== link.to
	);

	const neighbours: string[][] = keys.map(() => []);
	for (const link of valid) {
		neighbours[index[link.from]].push(link.to);
		neighbours[index[link.to]].push(link.from);
	}

	const fixed = keys.map((key) => !!placed[key]);
	const free = keys.filter((key) => !placed[key]);
	if (free.length === 0) return { ...placed };

	// Start from the best-connected entry and go outwards, so neighbours start out side by side.
	const order: number[] = [];
	const queued = keys.map(() => false);
	const byDegree = free
		.map((key) => index[key])
		.sort((a, b) => neighbours[b].length - neighbours[a].length || a - b);
	for (const start of byDegree) {
		if (queued[start]) continue;
		const queue = [start];
		queued[start] = true;
		while (queue.length > 0) {
			const i = queue.shift()!;
			order.push(i);
			for (const key of neighbours[i]) {
				const next = index[key];
				if (!queued[next] && !fixed[next]) {
					queued[next] = true;
					queue.push(next);
				}
			}
		}
	}

	// Beyond what's already placed, so a new entry with no placed neighbours doesn't land on one.
	let reach = 0;
	for (const key of keys) {
		if (placed[key]) reach = Math.max(reach, Math.hypot(placed[key].x, placed[key].y));
	}
	const outside = reach > 0 ? reach + LINK_LENGTH : 0;
	const springs = valid.map(
		(link) => [index[link.from], index[link.to], link.length] as [number, number, number]
	);

	/** One go at the layout, starting from the spiral turned by `turn`. */
	function attempt(turn: number) {
		const xs = new Float64Array(keys.length);
		const ys = new Float64Array(keys.length);
		const known = [...fixed];
		keys.forEach((key, i) => {
			if (placed[key]) [xs[i], ys[i]] = [placed[key].x, placed[key].y];
		});
		order.forEach((i, step) => {
			const angle = step * GOLDEN + turn;
			const near = neighbours[i].map((key) => index[key]).filter((j) => known[j]);
			if (near.length > 0) {
				const cx = near.reduce((sum, j) => sum + xs[j], 0) / near.length;
				const cy = near.reduce((sum, j) => sum + ys[j], 0) / near.length;
				xs[i] = cx + Math.cos(angle) * LINK_LENGTH * 0.7;
				ys[i] = cy + Math.sin(angle) * LINK_LENGTH * 0.7;
			} else {
				const radius = outside + LINK_LENGTH * 0.6 * Math.sqrt(step);
				xs[i] = Math.cos(angle) * radius;
				ys[i] = Math.sin(angle) * radius;
			}
			known[i] = true;
		});
		simulate(xs, ys, fixed, springs);
		return { xs, ys, faults: tangles(xs, ys, springs) };
	}

	// Tangles are what make a web hard to read, so a small one is laid out from a few starts and
	// the tidiest wins. A big one hasn't the time to spare.
	const tries = free.length < 3 ? 1 : keys.length <= 60 ? 5 : keys.length <= 120 ? 2 : 1;
	let best = attempt(0);
	for (let turn = 1; turn < tries && best.faults > 0; turn++) {
		const next = attempt((turn * Math.PI * 2) / tries + turn * 0.37);
		if (next.faults < best.faults) best = next;
	}
	const { xs, ys } = best;

	// A fresh web sits around the middle; one with fixed entries stays where they put it.
	if (!fixed.some(Boolean)) {
		let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
		keys.forEach((_, i) => {
			[minX, maxX] = [Math.min(minX, xs[i]), Math.max(maxX, xs[i])];
			[minY, maxY] = [Math.min(minY, ys[i]), Math.max(maxY, ys[i])];
		});
		const [cx, cy] = [(minX + maxX) / 2, (minY + maxY) / 2];
		keys.forEach((_, i) => {
			xs[i] -= cx;
			ys[i] -= cy;
		});
	}

	const positions: Record<string, Point> = {};
	keys.forEach((key, i) => (positions[key] = { x: round(xs[i]), y: round(ys[i]) }));
	return positions;
}

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * How tangled a layout is: each pair of lines that cross (leaving out pairs that share an end),
 * and three times over each entry sitting on a line that isn't its own, which hides a name.
 */
function tangles(xs: Float64Array, ys: Float64Array, springs: [number, number, number][]) {
	const side = (a: number, b: number, c: number) =>
		Math.sign((xs[b] - xs[a]) * (ys[c] - ys[a]) - (ys[b] - ys[a]) * (xs[c] - xs[a]));
	let count = 0;
	for (let i = 0; i < springs.length; i++) {
		const [a, b] = springs[i];
		for (let j = i + 1; j < springs.length; j++) {
			const [c, d] = springs[j];
			if (a === c || a === d || b === c || b === d) continue;
			if (side(a, b, c) !== side(a, b, d) && side(c, d, a) !== side(c, d, b)) count++;
		}
		const [ex, ey] = [xs[b] - xs[a], ys[b] - ys[a]];
		const squared = ex * ex + ey * ey || 1;
		for (let k = 0; k < xs.length; k++) {
			if (k === a || k === b) continue;
			const t = ((xs[k] - xs[a]) * ex + (ys[k] - ys[a]) * ey) / squared;
			if (t <= 0 || t >= 1) continue;
			if (Math.hypot(xs[k] - xs[a] - ex * t, ys[k] - ys[a] - ey * t) < 40) count += 3;
		}
	}
	return count;
}

/** Entries closer than this push each other hard: room for two circles and their names. */
const PERSONAL_SPACE = 160;

/** How the layout pulls and pushes. Exported so the numbers can be tried out in a test. */
export const FORCES = {
	repulsion: 22,
	spring: 0.6,
	gravity: 0.01,
	space: 1.5,
	clearance: 2
};

/** How far an entry keeps from a line it isn't on: its circle and the name under it. */
const CLEARANCE = 62;

function simulate(
	xs: Float64Array,
	ys: Float64Array,
	fixed: boolean[],
	springs: [number, number, number][]
) {
	const count = xs.length;
	// Every pair pushes on every other, so a big web gets fewer steps to stay quick.
	const steps = Math.max(60, Math.min(300, Math.round(1.2e7 / Math.max(count * count, 1))));
	const dx = new Float64Array(count);
	const dy = new Float64Array(count);
	const { repulsion, spring, gravity, space, clearance } = FORCES;

	for (let step = 0; step < steps; step++) {
		// Moves start bold and settle, so the web can untangle and then come to rest.
		const reach = LINK_LENGTH * 0.5 * (1 - step / steps) + 1;
		dx.fill(0);
		dy.fill(0);

		for (let i = 0; i < count; i++) {
			for (let j = i + 1; j < count; j++) {
				let ox = xs[i] - xs[j];
				let oy = ys[i] - ys[j];
				let squared = ox * ox + oy * oy;
				if (squared < 0.0001) {
					// Two in one spot: nudge them apart the same way every time.
					ox = ((i * 7 + j * 13) % 11) - 5 || 1;
					oy = ((i * 5 + j * 3) % 9) - 4 || 1;
					squared = ox * ox + oy * oy;
				}
				const distance = Math.sqrt(squared);
				// Names run sideways, so entries side by side need more room than ones stacked up.
				const felt = Math.sqrt(ox * ox * 0.64 + oy * oy * 1.5625);
				// Fading with the square of the distance, so far-off entries barely push at all.
				let push = repulsion * (LINK_LENGTH / felt) ** 2;
				if (felt < PERSONAL_SPACE) push += (PERSONAL_SPACE - felt) * space;
				const fx = (ox / distance) * push;
				const fy = (oy / distance) * push;
				dx[i] += fx;
				dy[i] += fy;
				dx[j] -= fx;
				dy[j] -= fy;
			}
		}

		for (const [a, b, length] of springs) {
			const ox = xs[b] - xs[a];
			const oy = ys[b] - ys[a];
			const distance = Math.sqrt(ox * ox + oy * oy) || 0.01;
			const pull = (distance - length) * spring;
			const fx = (ox / distance) * pull;
			const fy = (oy / distance) * pull;
			dx[a] += fx;
			dy[a] += fy;
			dx[b] -= fx;
			dy[b] -= fy;
		}

		// Entries keep off lines that aren't theirs, so no line runs under someone else's name.
		for (const [a, b] of springs) {
			const [ex, ey] = [xs[b] - xs[a], ys[b] - ys[a]];
			const squared = ex * ex + ey * ey;
			if (squared < 1) continue;
			for (let i = 0; i < count; i++) {
				if (i === a || i === b) continue;
				const t = ((xs[i] - xs[a]) * ex + (ys[i] - ys[a]) * ey) / squared;
				// Past either end it's the entries' own room that keeps them apart.
				if (t <= 0.04 || t >= 0.96) continue;
				let [ox, oy] = [xs[i] - (xs[a] + ex * t), ys[i] - (ys[a] + ey * t)];
				let distance = Math.sqrt(ox * ox + oy * oy);
				if (distance >= CLEARANCE) continue;
				if (distance < 0.01) [ox, oy, distance] = [-ey, ex, Math.sqrt(squared)];
				const push = (CLEARANCE - distance) * clearance;
				const [fx, fy] = [(ox / distance) * push, (oy / distance) * push];
				dx[i] += fx;
				dy[i] += fy;
				// The line gives way too, mostly at the end nearer the entry.
				dx[a] -= fx * (1 - t);
				dy[a] -= fy * (1 - t);
				dx[b] -= fx * t;
				dy[b] -= fy * t;
			}
		}

		for (let i = 0; i < count; i++) {
			if (fixed[i]) continue;
			dx[i] -= xs[i] * gravity;
			dy[i] -= ys[i] * gravity;
			const move = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]);
			if (move > 0) {
				const scale = Math.min(move, reach) / move;
				xs[i] += dx[i] * scale;
				ys[i] += dy[i] * scale;
			}
		}
	}
}

// ---- Drawing a connection -------------------------------------------------------------------

/** How far apart two connections between the same pair bow, measured at their middles. */
export const BEND = 52;

/**
 * The line for one connection: a gentle curve from `a` to `b` that bows `bend` to one side at its
 * middle (0 is straight), stopping short of each end so it meets the edge of the circle there, not
 * its centre. `mid` is where its label goes, and `angle` (in degrees) points its arrowhead.
 */
export function curve(a: Point, b: Point, bend: number, startGap: number, endGap: number) {
	const [mx, my] = [(a.x + b.x) / 2, (a.y + b.y) / 2];
	const [ox, oy] = [b.x - a.x, b.y - a.y];
	const length = Math.hypot(ox, oy) || 1;
	const [nx, ny] = [-oy / length, ox / length];
	// A quadratic curve's middle is halfway from the chord to its control point.
	const control = { x: mx + nx * bend * 2, y: my + ny * bend * 2 };
	const mid = { x: mx + nx * bend, y: my + ny * bend };

	const toward = (from: Point, to: Point, distance: number) => {
		const [vx, vy] = [to.x - from.x, to.y - from.y];
		const size = Math.hypot(vx, vy) || 1;
		return { x: from.x + (vx / size) * distance, y: from.y + (vy / size) * distance };
	};
	const start = toward(a, control, startGap);
	const end = toward(b, control, endGap);
	const angle = (Math.atan2(end.y - control.y, end.x - control.x) * 180) / Math.PI;
	const path = `M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
	return { path, mid, end, angle };
}

/**
 * How far each connection bows, keyed by its id. One connection between a pair runs straight;
 * two or more fan out either side, whichever way each one reads.
 */
export function bends(edges: Pick<MapEdge, 'id' | 'from' | 'to'>[]): Record<number, number> {
	const pairs: Record<string, Pick<MapEdge, 'id' | 'from' | 'to'>[]> = {};
	for (const edge of edges) {
		const pair = edge.from < edge.to ? `${edge.from}|${edge.to}` : `${edge.to}|${edge.from}`;
		(pairs[pair] ??= []).push(edge);
	}
	const result: Record<number, number> = {};
	for (const group of Object.values(pairs)) {
		group.forEach((edge, i) => {
			const bend = (i - (group.length - 1) / 2) * BEND;
			// Bending is measured from `from` to `to`, so one reading the other way bends back.
			result[edge.id] = edge.from < edge.to ? bend : -bend;
		});
	}
	return result;
}
