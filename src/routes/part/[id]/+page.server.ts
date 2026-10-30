import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Parts are private to their owner; send signed-out visitors to log in.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
};
