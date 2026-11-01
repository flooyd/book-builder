import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isEntryType } from '$lib/bible';
import { appearancesOf, connectionsOf, findEntry } from '$lib/server/bible';

// An entry's page is private to its owner. The entry itself is in the client stores; this adds
// where it appears and what it's connected to.
export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	const { type } = params;
	const id = Number(params.id);
	if (!isEntryType(type) || !Number.isInteger(id)) error(404, "This page isn't on the shelf.");
	if (!(await findEntry(locals.user.id, type, id))) error(404, `This ${type} isn't on your shelf.`);

	return {
		type,
		id,
		appearances: await appearancesOf(type, id),
		connections: await connectionsOf(locals.user.id, type, id)
	};
};
