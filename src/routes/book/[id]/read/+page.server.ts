import { error, redirect } from '@sveltejs/kit';
import { findOwnedBook } from '$lib/server/ownership';
import { readableBook } from '$lib/server/reading';
import { READER_COOKIE, parseReaderPrefs } from '$lib/reading';
import type { PageServerLoad } from './$types';

// Reading mode for the book's owner, whether or not it is shared.
export const load: PageServerLoad = async ({ locals, params, cookies }) => {
	if (!locals.user) redirect(302, '/login');

	const id = Number(params.id);
	const found = Number.isInteger(id) ? await findOwnedBook(locals.user.id, id) : undefined;
	if (!found) error(404, 'There is no book here, or it belongs to someone else.');

	return {
		...(await readableBook(found)),
		owner: true,
		prefs: parseReaderPrefs(cookies.get(READER_COOKIE))
	};
};
