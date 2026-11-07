import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import {
	CONFIRMED,
	authMessage,
	errorCode,
	rememberPending,
	sendConfirmation
} from '$lib/server/account';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return { deleted: event.url.searchParams.has('deleted') };
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({ body: { email, password, callbackURL: CONFIRMED } });
		} catch (error) {
			// The password was right but the email isn't confirmed: send a new link.
			if (errorCode(error) === 'EMAIL_NOT_VERIFIED') {
				rememberPending(event.cookies, email);
				const sent = await sendConfirmation(email);
				return redirect(303, sent ? '/verify?login' : '/verify?login&unsent');
			}
			const message = authMessage(error, 'Log in failed.');
			if (message) return fail(400, { email, message });
			console.error(error);
			return fail(500, { email, message: 'Something went wrong. Try again.' });
		}

		return redirect(302, '/');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';

		if (!name) {
			return fail(400, { email, message: 'Add a name to create an account.' });
		}

		// Better Auth answers a sign-up for a taken address as if it worked, so that nobody can learn
		// who has an account; this page has always said so plainly, and still does.
		const [taken] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, email.toLowerCase()))
			.limit(1);
		if (taken) {
			return fail(400, {
				email,
				message: 'An account with that email already exists. Log in instead.'
			});
		}

		try {
			await auth.api.signUpEmail({ body: { email, password, name, callbackURL: CONFIRMED } });
		} catch (error) {
			const message = authMessage(error, 'Registration failed.');
			if (message) return fail(400, { email, message });
			console.error(error);
			return fail(500, { email, message: 'Something went wrong. Try again.' });
		}

		rememberPending(event.cookies, email);
		const sent = await sendConfirmation(email);
		return redirect(303, sent ? '/verify' : '/verify?unsent');
	}
};
