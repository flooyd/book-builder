import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { authMessage, errorCode, forgetPending } from '$lib/server/account';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

// Where the link in a reset email lands: Better Auth checks the token and sends it on here as
// ?token=, or as ?error=INVALID_TOKEN when it has expired or been used.
export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { token, expired: !token || url.searchParams.has('error') };
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const form = await request.formData();
		const token = form.get('token')?.toString() ?? '';
		const password = form.get('password')?.toString() ?? '';

		// Whose password this is, so they can be logged in with it once it's saved.
		const context = await auth.$context;
		const found = token
			? await context.internalAdapter.findVerificationValue(`reset-password:${token}`)
			: null;
		if (!found || found.expiresAt < new Date()) return fail(400, { expired: true, message: '' });
		const [owner] = await db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, found.value))
			.limit(1);

		try {
			await auth.api.resetPassword({ body: { newPassword: password, token } });
		} catch (error) {
			if (errorCode(error) === 'INVALID_TOKEN') return fail(400, { expired: true, message: '' });
			const message = authMessage(error, "Couldn't change your password.");
			if (message) return fail(400, { expired: false, message });
			console.error(error);
			return fail(500, { expired: false, message: 'Something went wrong. Try again.' });
		}

		// Every other device was signed out; this one comes in with the new password. Following the
		// link also confirmed the email (see onPasswordReset), so nothing is left waiting.
		forgetPending(cookies);
		try {
			if (owner) await auth.api.signInEmail({ body: { email: owner.email, password } });
		} catch (error) {
			console.error(error);
			redirect(303, '/login');
		}
		redirect(303, '/');
	}
};
