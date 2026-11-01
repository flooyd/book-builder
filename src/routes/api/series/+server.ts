import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { series } from '$lib/server/db/schema';
import { isIdList } from '$lib/server/outline';
import { descriptionField, textField } from '$lib/server/ownership';
import { ownsBooks, seriesOf, setSeriesBooks } from '$lib/server/series';

export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	return json(await seriesOf(user.id));
};

/** A new series, with the books in `bookIds` in that order, if there are any yet. */
export const POST = async (event: RequestEvent) => {
	const user = requireUser(event);
	const body = await event.request.json().catch(() => null);
	const title = textField(body?.title);
	if (!title) return json({ error: 'Title is required' }, { status: 400 });

	const bookIds = body?.bookIds ?? [];
	if (!isIdList(bookIds) || !(await ownsBooks(user.id, bookIds))) {
		return json({ error: 'Those books are not all yours' }, { status: 403 });
	}

	const created = await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(series)
			.values({ title, description: descriptionField(body?.description), userId: user.id })
			.returning();
		await setSeriesBooks(tx, row.id, bookIds);
		return row;
	});
	return json(created);
};
