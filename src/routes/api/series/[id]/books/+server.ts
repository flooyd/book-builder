import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { db } from '$lib/server/db';
import { isIdList } from '$lib/server/outline';
import { findOwnedSeries, ownsBooks, setSeriesBooks } from '$lib/server/series';

/**
 * The series' books in reading order. One list does all of it: adding a book, taking one out and
 * putting them in a new order are each a new list.
 */
export const PUT = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid series id' }, { status: 400 });
	if (!(await findOwnedSeries(user.id, id))) {
		return json({ error: 'Series not found' }, { status: 404 });
	}

	const body = await event.request.json().catch(() => null);
	if (!isIdList(body?.bookIds)) return json({ error: 'Expected { bookIds }' }, { status: 400 });
	const { bookIds } = body;
	if (!(await ownsBooks(user.id, bookIds))) {
		return json({ error: 'Those books are not all yours' }, { status: 403 });
	}

	await db.transaction((tx) => setSeriesBooks(tx, id, bookIds));
	return json({ bookIds });
};
