import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import {
	CONFIRMED,
	authMessage,
	forgetPending,
	pendingEmail,
	rememberPending
} from '$lib/server/account';

// "Check your inbox" after signing up, and where the link in the email comes back to: signed in
// when it worked, with the reason when it didn't.
export const load: PageServerLoad = ({ locals, url, cookies }) => {
	if (locals.user) {
		forgetPending(cookies);
		redirect(302, '/');
	}
	const error = url.searchParams.get('error');
	return {
		email: pendingEmail(cookies),
		/** They tried to log in before confirming. */
		login: url.searchParams.has('login'),
		/** The email couldn't be sent (see sendConfirmation). */
		unsent: url.searchParams.has('unsent'),
		/** The link was followed, but it was already used: confirmed, though not signed in here. */
		confirmed: url.searchParams.has('confirmed') && !error,
		problem: !error
			? null
			: error === 'TOKEN_EXPIRED'
				? ('expired' as const)
				: error === 'USER_NOT_FOUND'
					? ('gone' as const)
					: ('invalid' as const)
	};
};

export const actions: Actions = {
	// Send the link again. Better Auth says nothing about addresses that have no account, or are
	// already confirmed, so neither does this.
	resend: async ({ request, cookies }) => {
		const form = await request.formData();
		const email = form.get('email')?.toString().trim() ?? '';
		if (!email) return fail(400, { email, message: 'Add the email you signed up with.' });

		try {
			await auth.api.sendVerificationEmail({ body: { email, callbackURL: CONFIRMED } });
		} catch (error) {
			const message = authMessage(error, "Couldn't send the email.");
			if (message) return fail(400, { email, message });
			console.error(error);
			return fail(500, { email, message: "Couldn't send the email. Try again in a while." });
		}

		rememberPending(cookies, email);
		return { email, sent: true };
	}
};
