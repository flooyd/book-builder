import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The studio's shelf. Drawings are kept in the browser, so the server only checks who's asking.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return { owner: locals.user.id };
};
