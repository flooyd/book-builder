import { redirect, type Actions } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/');
	}
	await auth.api.signOut({
		headers: event.request.headers
	});
	return redirect(302, '/');
};
