import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { bookWordCounts } from '$lib/server/goals';
import { profileOf } from '$lib/server/profile';
import { findOwnedSeries } from '$lib/server/series';
import type { PageServerLoad } from './$types';

// A series' own page is private to its owner. Its books are in the client stores, so this only
// adds what they don't know: how long each one is, and the writer's public page, if it's on.
export const load: PageServerLoad = async ({ locals, params, depends }) => {
	depends('app:series-words');
	if (!locals.user) redirect(302, '/login');
	const id = Number(params.id);
	if (!Number.isInteger(id) || !(await findOwnedSeries(locals.user.id, id))) {
		error(404, "This series isn't on your shelf.");
	}
	const books = await db.select({ id: book.id }).from(book).where(eq(book.seriesId, id));
	const profile = await profileOf(locals.user.id);
	return {
		id,
		handle: profile.isPublic ? profile.handle : null,
		words: await bookWordCounts(
			locals.user.id,
			books.map((row) => row.id)
		)
	};
};
