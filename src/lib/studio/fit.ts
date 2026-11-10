// Turning a freehand line into a few smooth curves, for the pencil: steady the points, then fit
// cubic Béziers to them by Philip J. Schneider's method ("An Algorithm for Automatically Fitting
// Digitized Curves", Graphics Gems, 1990): fit one curve to all the points, and where it misses
// by too much, split there and fit each half. The result is a path like any other, to edit point
// by point. No DOM, so it can be tested alone.

import type { Anchor } from '$lib/drawing';

export type Point = { x: number; y: number };
type Cubic = [Point, Point, Point, Point];

const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const times = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;
const length = (a: Point) => Math.hypot(a.x, a.y);
const unitOf = (a: Point): Point => {
	const size = length(a);
	return size ? { x: a.x / size, y: a.y / size } : { x: 0, y: 0 };
};

/** Points closer together than this, in pixels, are one point. */
function withoutRepeats(points: Point[], gap: number) {
	const kept: Point[] = [];
	for (const point of points) {
		const last = kept.at(-1);
		if (!last || Math.hypot(point.x - last.x, point.y - last.y) >= gap) kept.push(point);
	}
	const end = points.at(-1);
	if (end && kept.length > 1 && kept.at(-1) !== end) kept[kept.length - 1] = end;
	return kept;
}

/**
 * The points with the tremor taken out: each moved towards the average of its neighbours,
 * `strength` from 0 (as drawn) to 1 (very steady). The ends stay where they were.
 */
export function steady(points: Point[], strength: number): Point[] {
	if (strength <= 0 || points.length < 3) return points;
	const reach = Math.max(1, Math.round(strength * 6));
	return points.map((point, index) => {
		if (index === 0 || index === points.length - 1) return point;
		const from = Math.max(0, index - reach);
		const to = Math.min(points.length - 1, index + reach);
		let x = 0;
		let y = 0;
		for (let near = from; near <= to; near++) {
			x += points[near].x;
			y += points[near].y;
		}
		const count = to - from + 1;
		return {
			x: point.x + (x / count - point.x) * strength,
			y: point.y + (y / count - point.y) * strength
		};
	});
}

// Bernstein polynomials of a cubic.
const b0 = (u: number) => (1 - u) ** 3;
const b1 = (u: number) => 3 * u * (1 - u) ** 2;
const b2 = (u: number) => 3 * u * u * (1 - u);
const b3 = (u: number) => u ** 3;

function at(curve: Cubic, u: number): Point {
	const [p0, p1, p2, p3] = curve;
	return {
		x: b0(u) * p0.x + b1(u) * p1.x + b2(u) * p2.x + b3(u) * p3.x,
		y: b0(u) * p0.y + b1(u) * p1.y + b2(u) * p2.y + b3(u) * p3.y
	};
}

/** Each point's place along the line, 0 to 1, by distance. */
function chordLengths(points: Point[], first: number, last: number) {
	const u = [0];
	for (let index = first + 1; index <= last; index++) {
		u.push(u[index - first - 1] + length(sub(points[index], points[index - 1])));
	}
	const total = u[u.length - 1] || 1;
	return u.map((value) => value / total);
}

/** The curve between two points that best fits those between, with its end tangents given. */
function bestCurve(
	points: Point[],
	first: number,
	last: number,
	u: number[],
	tangent1: Point,
	tangent2: Point
): Cubic {
	const start = points[first];
	const end = points[last];
	const c = [
		[0, 0],
		[0, 0]
	];
	const x = [0, 0];
	for (let index = 0; index < u.length; index++) {
		const a0 = times(tangent1, b1(u[index]));
		const a1 = times(tangent2, b2(u[index]));
		c[0][0] += dot(a0, a0);
		c[0][1] += dot(a0, a1);
		c[1][1] += dot(a1, a1);
		const rest = sub(
			points[first + index],
			add(times(start, b0(u[index]) + b1(u[index])), times(end, b2(u[index]) + b3(u[index])))
		);
		x[0] += dot(a0, rest);
		x[1] += dot(a1, rest);
	}
	c[1][0] = c[0][1];
	const det = c[0][0] * c[1][1] - c[1][0] * c[0][1];
	let alpha1 = det ? (x[0] * c[1][1] - x[1] * c[0][1]) / det : 0;
	let alpha2 = det ? (c[0][0] * x[1] - c[1][0] * x[0]) / det : 0;
	const span = length(sub(end, start));
	// A handle pointing backwards, or none at all, gives a poor curve: use a third of the span.
	if (alpha1 < 1e-6 * span || alpha2 < 1e-6 * span) alpha1 = alpha2 = span / 3;
	return [start, add(start, times(tangent1, alpha1)), add(end, times(tangent2, alpha2)), end];
}

/** A better place along the curve for each point, by one step of Newton's method. */
function improve(curve: Cubic, points: Point[], first: number, u: number[]) {
	const [p0, p1, p2, p3] = curve;
	const d1 = [times(sub(p1, p0), 3), times(sub(p2, p1), 3), times(sub(p3, p2), 3)];
	const d2 = [times(sub(d1[1], d1[0]), 2), times(sub(d1[2], d1[1]), 2)];
	return u.map((value, index) => {
		const point = points[first + index];
		const miss = sub(at(curve, value), point);
		const v = value;
		const first1 = add(
			add(times(d1[0], (1 - v) ** 2), times(d1[1], 2 * v * (1 - v))),
			times(d1[2], v * v)
		);
		const second = add(times(d2[0], 1 - v), times(d2[1], v));
		const denominator = dot(first1, first1) + dot(miss, second);
		if (!denominator) return value;
		return Math.max(0, Math.min(1, value - dot(miss, first1) / denominator));
	});
}

function worstMiss(curve: Cubic, points: Point[], first: number, last: number, u: number[]) {
	let worst = 0;
	let split = Math.floor((last - first + 1) / 2) + first;
	for (let index = first + 1; index < last; index++) {
		const miss = length(sub(at(curve, u[index - first]), points[index])) ** 2;
		if (miss >= worst) {
			worst = miss;
			split = index;
		}
	}
	return { worst, split };
}

function fitBetween(
	points: Point[],
	first: number,
	last: number,
	tangent1: Point,
	tangent2: Point,
	error: number,
	out: Cubic[]
) {
	if (last - first === 1) {
		const span = length(sub(points[last], points[first])) / 3;
		out.push([
			points[first],
			add(points[first], times(tangent1, span)),
			add(points[last], times(tangent2, span)),
			points[last]
		]);
		return;
	}
	let u = chordLengths(points, first, last);
	let curve = bestCurve(points, first, last, u, tangent1, tangent2);
	let { worst, split } = worstMiss(curve, points, first, last, u);
	if (worst < error) {
		out.push(curve);
		return;
	}
	if (worst < error * 4) {
		for (let round = 0; round < 4; round++) {
			u = improve(curve, points, first, u);
			curve = bestCurve(points, first, last, u, tangent1, tangent2);
			({ worst, split } = worstMiss(curve, points, first, last, u));
			if (worst < error) {
				out.push(curve);
				return;
			}
		}
	}
	const centre = unitOf(sub(points[split - 1], points[split + 1]));
	fitBetween(points, first, split, tangent1, centre, error, out);
	fitBetween(points, split, last, times(centre, -1), tangent2, error, out);
}

/**
 * Fits curves to a freehand line, missing no point by more than `tolerance` pixels, and returns
 * them as a path's anchors. Joins inside the line are smooth.
 */
export function fitAnchors(raw: Point[], tolerance: number): Anchor[] {
	const points = withoutRepeats(raw, Math.max(0.5, tolerance / 4));
	if (points.length === 0) return [];
	if (points.length === 1) {
		const { x, y } = points[0];
		return [[x, y, x, y, x, y, 0]];
	}
	const curves: Cubic[] = [];
	const last = points.length - 1;
	fitBetween(
		points,
		0,
		last,
		unitOf(sub(points[1], points[0])),
		unitOf(sub(points[last - 1], points[last])),
		tolerance * tolerance,
		curves
	);
	const anchors: Anchor[] = [];
	curves.forEach((curve, index) => {
		const [start, out] = curve;
		const handleIn = index > 0 ? curves[index - 1][2] : start;
		anchors.push([start.x, start.y, handleIn.x, handleIn.y, out.x, out.y, index > 0 ? 1 : 0]);
	});
	const end = curves[curves.length - 1];
	anchors.push([end[3].x, end[3].y, end[2].x, end[2].y, end[3].x, end[3].y, 0]);
	return anchors;
}
