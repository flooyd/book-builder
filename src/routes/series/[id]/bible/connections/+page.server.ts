import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { connectionsIn } from '$lib/server/bible';
import { db } from '$lib/server/db';
import { book } from '$lib/server/db/schema';
import { findOwnedSeries } from '$lib/server/series';
import type { PageServerLoad } from './$types';

// The connections map of a whole series: every connection touching an entry in any of its books.
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	const id = Number(params.id);
	if (!Number.isInteger(id) || !(await findOwnedSeries(locals.user.id, id))) {
		error(404, "This series isn't on your shelf.");
	}
	const books = await db.select({ id: book.id }).from(book).where(eq(book.seriesId, id));
	return {
		id,
		connections: await connectionsIn(
			locals.user.id,
			books.map((row) => row.id)
		)
	};
};
