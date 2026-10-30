import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

// Friendlier copy for the errors people actually hit; anything else falls back to Better Auth's.
const MESSAGES: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: "That email and password don't match.",
	INVALID_EMAIL: "That doesn't look like an email address.",
	USER_ALREADY_EXISTS: 'An account with that email already exists. Log in instead.',
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		'An account with that email already exists. Log in instead.',
	PASSWORD_TOO_SHORT: 'Use at least 8 characters for your password.',
	PASSWORD_TOO_LONG: 'That password is too long.'
};

function messageFor(error: APIError, fallback: string) {
	const code = (error.body as { code?: string } | undefined)?.code;
	return (code && MESSAGES[code]) || error.message || fallback;
}

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { email, message: messageFor(error, 'Log in failed.') });
			}
			return fail(500, { email, message: 'Something went wrong. Try again.' });
		}

		return redirect(302, '/');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString().trim() ?? '';

		if (!name) {
			return fail(400, { email, message: 'Add a name to create an account.' });
		}

		try {
			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { email, message: messageFor(error, 'Registration failed.') });
			}
			return fail(500, { email, message: 'Something went wrong. Try again.' });
		}

		return redirect(302, '/');
	}
};
