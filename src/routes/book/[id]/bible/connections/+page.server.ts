import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { connectionsIn } from '$lib/server/bible';
import { findOwnedBook } from '$lib/server/ownership';

// A book's connections map is private to its owner. The entries are in the client stores, so this
// only adds the connections between them, which the browser lays out as a web.
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	const id = Number(params.id);
	if (!Number.isInteger(id) || !(await findOwnedBook(locals.user.id, id))) {
		error(404, "This book isn't on your shelf.");
	}
	return { id, connections: await connectionsIn(locals.user.id, [id]) };
};
