import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { appearanceCounts } from '$lib/server/bible';
import { findOwnedBook } from '$lib/server/ownership';

// A book's story bible is private to its owner; the entries themselves are in the client stores,
// so this only adds what the stores don't know: how often each one appears.
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	const id = Number(params.id);
	if (!Number.isInteger(id) || !(await findOwnedBook(locals.user.id, id))) {
		error(404, "This book isn't on your shelf.");
	}
	return { counts: await appearanceCounts(id) };
};
