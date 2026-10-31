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

/**
 * The streak: how many days in a row reached the daily target, ending today, or yesterday while
 * today is still open. `best` is the longest run in the days given.
 */
export function streakOf(days: GoalDays, target: number, today: string) {
	let current = 0;
	let day = reached(wordsOn(days, today), target) ? today : addDays(today, -1);
	while (reached(wordsOn(days, day), target)) {
		current++;
		day = addDays(day, -1);
	}

	let best = 0;
	let run = 0;
	let previous = '';
	for (const key of Object.keys(days).sort()) {
		if (!reached(wordsOn(days, key), target)) {
			run = 0;
			continue;
		}
		run = previous && daysBetween(previous, key) === 1 ? run + 1 : 1;
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
 * once it has passed); `perDay` is what each remaining day, today included, has to add.
 */
export function bookProgress(
	words: number,
	targetWords: number | null,
	deadline: string | null,
	today: string
) {
	const fraction = targetWords ? Math.min(1, words / targetWords) : 0;
	const wordsLeft = targetWords ? Math.max(0, targetWords - words) : 0;
	const daysLeft = deadline ? daysBetween(today, deadline) : null;
	const perDay =
		targetWords && daysLeft !== null && daysLeft >= 0 && wordsLeft > 0
			? Math.ceil(wordsLeft / (daysLeft + 1))
			: null;
	return { fraction, wordsLeft, daysLeft, perDay, done: !!targetWords && wordsLeft === 0 };
}
