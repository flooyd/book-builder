import type { RequestEvent } from '@sveltejs/kit';
import { and, eq, gte, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book, chapter, part, writingDay, writingGoal } from '$lib/server/db/schema';
import { storyTexts } from '$lib/server/outline';
import { countWords } from '$lib/reading';
import { plainText } from '$lib/rich';
import {
	TIME_ZONE_COOKIE,
	addDays,
	dayIn,
	validTimeZone,
	type GoalDays,
	type GoalsData
} from '$lib/goals';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const HISTORY_DAYS = 400;

/** The writer's day right now, from the time zone the layout reported (UTC until it has). */
export function todayFor(event: RequestEvent) {
	const timeZone = validTimeZone(event.cookies.get(TIME_ZONE_COOKIE)) ?? 'UTC';
	return dayIn(timeZone);
}

/** Words in a saved piece of story text, counted as the editor counts them. */
export const wordsIn = (content: string) => countWords(plainText(content));

/**
 * Add `delta` words (or take them away) from the writer's tally for `day`. Returns the day's
 * total. A save that changes nothing doesn't make a row.
 */
export async function recordWords(tx: Tx, userId: string, day: string, delta: number) {
	if (delta === 0) {
		const [row] = await tx
			.select({ words: writingDay.words })
			.from(writingDay)
			.where(and(eq(writingDay.userId, userId), eq(writingDay.day, day)));
		return Math.max(0, row?.words ?? 0);
	}
	const [row] = await tx
		.insert(writingDay)
		.values({ userId, day, words: delta })
		.onConflictDoUpdate({
			target: [writingDay.userId, writingDay.day],
			set: { words: sql`${writingDay.words} + ${delta}` }
		})
		.returning({ words: writingDay.words });
	return Math.max(0, row.words);
}

/** Words so far in each of the given books (all owned by `userId`), by book id. */
export async function bookWordCounts(userId: string, bookIds: number[]) {
	const counts: Record<number, number> = {};
	for (const bookId of bookIds) {
		const parts = await db
			.select({ id: part.id })
			.from(part)
			.where(and(eq(part.bookId, bookId), eq(part.userId, userId)));
		const partIds = parts.map((p) => p.id);
		const chapters = partIds.length
			? await db.select({ id: chapter.id }).from(chapter).where(inArray(chapter.partId, partIds))
			: [];
		const texts = await storyTexts(
			partIds,
			chapters.map((c) => c.id)
		);
		counts[bookId] = Object.values(texts).reduce((sum, content) => sum + wordsIn(content), 0);
	}
	return counts;
}

/** Everything the goals screens need about one writer. */
export async function goalsFor(userId: string, today: string): Promise<GoalsData> {
	const [goal] = await db.select().from(writingGoal).where(eq(writingGoal.userId, userId));
	const rows = await db
		.select({ day: writingDay.day, words: writingDay.words })
		.from(writingDay)
		.where(and(eq(writingDay.userId, userId), gte(writingDay.day, addDays(today, -HISTORY_DAYS))));
	const days: GoalDays = {};
	for (const row of rows) days[row.day] = row.words;

	const targeted = await db
		.select({ id: book.id })
		.from(book)
		.where(and(eq(book.userId, userId), isNotNull(book.targetWords)));
	const bookWords = await bookWordCounts(
		userId,
		targeted.map((b) => b.id)
	);

	return {
		dailyWords: goal?.dailyWords ?? 0,
		restDays: goal?.restDays ?? 0,
		today,
		days,
		bookWords
	};
}
