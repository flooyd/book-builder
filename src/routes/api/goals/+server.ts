import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { writingGoal } from '$lib/server/db/schema';
import { goalsFor, todayFor } from '$lib/server/goals';
import { MAX_DAILY_WORDS, isRestMask } from '$lib/goals';

/**
 * The signed-in writer's goals: their daily target, the words they wrote on each recent day, and
 * the progress of every book that has a word target.
 */
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	return json(await goalsFor(user.id, todayFor(event)));
};

/**
 * Set the daily target: `dailyWords`, a whole number from 0 (no goal) up to the limit, and
 * optionally `restDays`, a mask of up to six weekdays (see $lib/goals). Leaving `restDays` out
 * keeps the writer's rest days as they are.
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const dailyWords = body?.dailyWords;
	const restDays = body?.restDays;

	if (!Number.isInteger(dailyWords) || dailyWords < 0 || dailyWords > MAX_DAILY_WORDS) {
		return json(
			{
				error: `A daily goal is a whole number of words, up to ${MAX_DAILY_WORDS.toLocaleString('en')}.`
			},
			{ status: 400 }
		);
	}
	if (restDays !== undefined && !isRestMask(restDays)) {
		return json({ error: 'Keep at least one weekday for writing.' }, { status: 400 });
	}

	const changes = restDays === undefined ? { dailyWords } : { dailyWords, restDays };
	await db
		.insert(writingGoal)
		.values({ userId: user.id, ...changes })
		.onConflictDoUpdate({ target: writingGoal.userId, set: changes });

	return json(await goalsFor(user.id, todayFor(event)));
};
