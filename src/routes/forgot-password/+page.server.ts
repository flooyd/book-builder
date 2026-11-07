import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { authMessage } from '$lib/server/account';

// Ask for a link to choose a new password. The answer is the same whether or not the address has
// an account, so the page can't be used to find out who does.
export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(302, '/settings');
	return { email: url.searchParams.get('email') ?? '' };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const email = form.get('email')?.toString().trim() ?? '';
		if (!email) return fail(400, { email, message: 'Add the email you log in with.' });

		try {
			await auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
		} catch (error) {
			const message = authMessage(error, "Couldn't send the email.");
			if (message) return fail(400, { email, message });
			console.error(error);
			return fail(500, { email, message: "Couldn't send the email. Try again in a while." });
		}
		return { email, sent: true };
	}
};
