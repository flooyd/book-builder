import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// A drawing in the studio. It lives in this browser (IndexedDB), so the server only checks who's
// asking, and its page says "Opening the drawing…" until the browser has it.
export const load: PageServerLoad = ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');
	return { owner: locals.user.id, key: params.key };
};
