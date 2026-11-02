import { error, redirect } from '@sveltejs/kit';
import { wordMaps } from '$lib/server/insights';
import { findOwnedBook } from '$lib/server/ownership';
import type { PageServerLoad } from './$types';

// Word maps quote the story text and say who said what, so they're for the owner alone, shared or
// not.
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');

	const id = Number(params.id);
	const found = Number.isInteger(id) ? await findOwnedBook(locals.user.id, id) : undefined;
	if (!found) error(404, "This book isn't on your shelf.");

	return {
		book: { id: found.id, title: found.title },
		maps: await wordMaps(found)
	};
};
