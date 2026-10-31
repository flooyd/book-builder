/**
 * Writing goals: the arithmetic behind the daily target, the streak and a book's deadline.
 * Days are plain 'YYYY-MM-DD' strings in the writer's own time zone, so none of this depends on
 * where the server runs.
 */

/** The cookie that tells the server the writer's time zone (set by the layout). */
export const TIME_ZONE_COOKIE = 'bb-tz';

export const MAX_DAILY_WORDS = 100_000;
export const MAX_BOOK_WORDS = 2_000_000;

export type GoalDays = Record<string, number>;

/** What the client keeps about the signed-in writer's goals (see $lib/stores). */
export type GoalsData = {
	/** The daily word target; 0 when none is set. */
	dailyWords: number;
	/** Weekdays kept for rest, as a mask (see `isRestDay`); 0 when there are none. */
	restDays: number;
	/** The writer's current day. */
	today: string;
	/** Words written per day, for roughly the last year. */
	days: GoalDays;
	/** Words so far in each book that has a target, by book id. */
	bookWords: Record<number, number>;
};

/** An IANA time zone such as "Europe/London", or null if the runtime doesn't know it. */
export function validTimeZone(value: unknown) {
	if (typeof value !== 'string' || !value) return null;
	try {
		new Intl.DateTimeFormat('en-CA', { timeZone: value });
		return value;
	} catch {
		return null;
	}
}

/** The calendar day it is at `at` in `timeZone`. */
export function dayIn(timeZone: string, at = new Date()) {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(at);
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether `value` is a real calendar day written 'YYYY-MM-DD'. */
export function isDay(value: unknown): value is string {
	const match = typeof value === 'string' ? DAY.exec(value) : null;
	if (!match) return false;
	const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
	return date.toISOString().slice(0, 10) === value;
}

/** The day `count` days after `day` (before it, if negative). */
export function addDays(day: string, count: number) {
	const [year, month, date] = day.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, date + count)).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string) {
	return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** The words written on a day, never counted below zero. */
export const wordsOn = (days: GoalDays, day: string) => Math.max(0, days[day] ?? 0);

/** A day counts toward the streak if the target was reached (or, with no target, any words). */
const reached = (words: number, target: number) => words > 0 && words >= target;

/** Rest days are weekdays kept for rest, as a bit mask: Monday is 1, Tuesday 2, ... Sunday 64. */
export const NO_REST_DAYS = 0;
/** Every weekday but one: a writer always keeps at least one writing day. */
export const MAX_REST_DAYS = 126;

/** Whether `restDays` is a mask of up to six weekdays. */
export const isRestMask = (value: unknown): value is number =>
	Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_REST_DAYS;

/** Whether `day` falls on one of the weekdays in the `restDays` mask. */
export const isRestDay = (day: string, restDays: number) =>
	((restDays >> weekdayOf(day)) & 1) === 1;

/**
 * The streak: how many writing days in a row reached the daily target, ending today, or
 * yesterday while today is still open. A rest day that didn't reach it is skipped, so it neither
 * breaks the streak nor adds to it; one that did reach it counts like any other day. `best` is the
 * longest run in the days given.
 */
export function streakOf(days: GoalDays, target: number, today: string, restDays = NO_REST_DAYS) {
	const hit = (day: string) => reached(wordsOn(days, day), target);

	let current = 0;
	let day = today;
	// Today is still open, so it only adds to the streak if it's already reached.
	if (hit(day)) current++;
	for (let steps = 0; steps < 800; steps++) {
		day = addDays(day, -1);
		if (hit(day)) current++;
		else if (!isRestDay(day, restDays)) break;
	}

	let best = 0;
	let run = 0;
	let previous = '';
	for (const key of Object.keys(days).sort()) {
		if (!hit(key)) continue;
		// Only rest days between this one and the last reached day keep the run going.
		const gap = previous ? daysBetween(previous, key) : 0;
		let joined = gap > 0;
		for (let i = 1; joined && i < gap; i++) {
			if (!isRestDay(addDays(previous, i), restDays)) joined = false;
		}
		run = joined ? run + 1 : 1;
		previous = key;
		best = Math.max(best, run);
	}
	return { current, best: Math.max(best, current) };
}

/** The last `count` days up to and including `today`, oldest first, with the words each had. */
export function recentDays(days: GoalDays, today: string, count: number) {
	return Array.from({ length: count }, (_, i) => {
		const day = addDays(today, i - count + 1);
		return { day, words: wordsOn(days, day) };
	});
}

/**
 * Where a book stands against its goal. `daysLeft` counts from today to the deadline (negative
 * once it has passed); `perDay` is what each remaining writing day, today included, has to add.
 */
export function bookProgress(
	words: number,
	targetWords: number | null,
	deadline: string | null,
	today: string,
	restDays = NO_REST_DAYS
) {
	const fraction = targetWords ? Math.min(1, words / targetWords) : 0;
	const wordsLeft = targetWords ? Math.max(0, targetWords - words) : 0;
	const daysLeft = deadline ? daysBetween(today, deadline) : null;
	// Rest days between now and the deadline aren't days to count on, unless nothing else is left.
	let writingDays = daysLeft === null ? 0 : daysLeft + 1;
	if (daysLeft !== null && daysLeft >= 0 && daysLeft < 3700) {
		const open = Array.from({ length: daysLeft + 1 }, (_, i) => addDays(today, i)).filter(
			(day) => !isRestDay(day, restDays)
		).length;
		writingDays = open || writingDays;
	}
	const perDay =
		targetWords && daysLeft !== null && daysLeft >= 0 && wordsLeft > 0
			? Math.ceil(wordsLeft / writingDays)
			: null;
	return { fraction, wordsLeft, daysLeft, perDay, done: !!targetWords && wordsLeft === 0 };
}

/** 0 for Monday through 6 for Sunday. */
export function weekdayOf(day: string) {
	const [year, month, date] = day.split('-').map(Number);
	return (new Date(Date.UTC(year, month - 1, date)).getUTCDay() + 6) % 7;
}

/**
 * The writing history as a calendar: `weeks` columns of seven days (Monday first) ending with the
 * week that holds `today`. Days after today are null.
 */
export function historyGrid(days: GoalDays, today: string, weeks: number) {
	const first = addDays(addDays(today, -weekdayOf(today)), -(weeks - 1) * 7);
	return Array.from({ length: weeks }, (_, week) =>
		Array.from({ length: 7 }, (_, weekday) => {
			const day = addDays(first, week * 7 + weekday);
			return day > today ? null : { day, words: wordsOn(days, day) };
		})
	);
}

/** How strongly to colour a day, 0 (nothing written) to 4 (well past the goal). */
export function historyLevel(words: number, target: number, tallest: number) {
	if (words <= 0) return 0;
	const goal = target > 0 ? target : Math.max(1, tallest * 0.6);
	if (words < goal * 0.5) return 1;
	if (words < goal) return 2;
	return words < goal * 1.5 ? 3 : 4;
}

/** Totals over the last `count` days up to and including `today`. */
export function historySummary(
	days: GoalDays,
	today: string,
	count: number,
	target: number,
	restDays = NO_REST_DAYS
) {
	let total = 0;
	let active = 0;
	let tallest = 0;
	let bestDay = '';
	for (let i = 0; i < count; i++) {
		const day = addDays(today, -i);
		const words = wordsOn(days, day);
		if (words <= 0) continue;
		total += words;
		active++;
		if (words > tallest) {
			tallest = words;
			bestDay = day;
		}
	}
	return {
		total,
		active,
		tallest,
		bestDay,
		average: active ? Math.round(total / active) : 0,
		longestStreak: streakOf(days, target, today, restDays).best
	};
}
