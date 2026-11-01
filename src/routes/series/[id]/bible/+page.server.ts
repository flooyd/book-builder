import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { appearanceCounts } from '$lib/server/bible';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { findOwnedSeries } from '$lib/server/series';
import type { PageServerLoad } from './$types';

// The story bible of a whole series. The entries are in the client stores, so this only adds how
// often each one appears across the books.
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	const id = Number(params.id);
	if (!Number.isInteger(id) || !(await findOwnedSeries(locals.user.id, id))) {
		error(404, "This series isn't on your shelf.");
	}
	const books = await db.select({ id: book.id }).from(book).where(eq(book.seriesId, id));
	return { id, counts: await appearanceCounts(books.map((row) => row.id)) };
};
