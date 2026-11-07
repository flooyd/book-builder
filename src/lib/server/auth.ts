import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { sendEmail } from '$lib/server/email';
import { resetPasswordEmail, verifyEmail } from '$lib/server/emails';

/** ORIGIN as it was typed into Vercel or .env, made exact: a trailing slash or quotes would give
 * Better Auth links to an address it doesn't recognise. Unset, it follows each request's site. */
const origin =
	(env.ORIGIN ?? '')
		.trim()
		.replace(/^(["'])(.*)\1$/, '$2')
		.trim()
		.replace(/\/+$/, '') || undefined;

// A new account can't be used until its email is confirmed: signing up sends the link, and
// logging in before then sends a fresh one instead of a session. The link signs them in. The log-in
// page sends those two itself (sendConfirmation in ./account), so it knows when one fails; Better
// Auth would only log it.
export const auth = betterAuth({
	baseURL: origin,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'pg' }),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		resetPasswordTokenExpiresIn: 60 * 60,
		revokeSessionsOnPasswordReset: true,
		sendResetPassword: ({ user, url }) => sendEmail(resetPasswordEmail(user, url)),
		// The link reached their inbox, which proves the address as well as a confirmation would.
		onPasswordReset: async ({ user }) => {
			if (user.emailVerified) return;
			await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.id, user.id));
		}
	},
	emailVerification: {
		sendOnSignUp: false,
		sendOnSignIn: false,
		autoSignInAfterVerification: true,
		expiresIn: 24 * 60 * 60,
		sendVerificationEmail: ({ user, url }) => sendEmail(verifyEmail(user, url))
	},
	user: {
		// Everything a writer has hangs off their user row and cascades with it (see the schema).
		deleteUser: { enabled: true }
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
