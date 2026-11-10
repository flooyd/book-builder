import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The art shelf. Its pictures load in the browser with the rest of the library.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return { owner: locals.user.id };
};
