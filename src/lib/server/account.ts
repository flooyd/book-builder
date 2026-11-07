import type { Cookies } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { auth } from './auth';
import { EmailTooSoon } from './email';

// What the log-in, confirm-your-email and password pages share.

/** Where a confirmation link lands, whether it worked or not (Better Auth adds ?error=). */
export const CONFIRMED = '/verify?confirmed';

// Friendlier copy for the errors people actually hit; anything else falls back to Better Auth's.
const MESSAGES: Record<string, string> = {
	INVALID_EMAIL_OR_PASSWORD: "That email and password don't match.",
	INVALID_EMAIL: "That doesn't look like an email address.",
	USER_ALREADY_EXISTS: 'An account with that email already exists. Log in instead.',
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
		'An account with that email already exists. Log in instead.',
	PASSWORD_TOO_SHORT: 'Use at least 8 characters for your password.',
	PASSWORD_TOO_LONG: 'That password is too long.',
	INVALID_PASSWORD: "That password isn't right.",
	INVALID_TOKEN: 'That link has expired or has already been used.'
};

export const errorCode = (error: unknown) =>
	error instanceof APIError ? (error.body as { code?: string } | undefined)?.code : undefined;

/** A sentence for what went wrong, or null when it isn't something to tell a writer. */
export function authMessage(error: unknown, fallback: string) {
	if (error instanceof EmailTooSoon) return TOO_SOON;
	if (!(error instanceof APIError)) return null;
	const code = errorCode(error);
	return (code && MESSAGES[code]) || error.message || fallback;
}

export const TOO_SOON =
	'We sent an email a moment ago. Check your inbox (and spam), or try again in a minute.';

/**
 * Sends the link that confirms an account's email. False when it couldn't go out; one sent a
 * moment ago counts as sent. Says nothing about addresses with no account, or already confirmed.
 */
export async function sendConfirmation(email: string) {
	try {
		await auth.api.sendVerificationEmail({ body: { email, callbackURL: CONFIRMED } });
		return true;
	} catch (error) {
		if (error instanceof EmailTooSoon) return true;
		console.error(error);
		return false;
	}
}

// The address waiting to be confirmed, so the "check your inbox" page can name it and send the
// link again. Only ever the visitor's own: it's set when they sign up or log in with it.
const PENDING = 'bb-pending-email';

export function rememberPending(cookies: Cookies, email: string) {
	cookies.set(PENDING, email.trim().toLowerCase(), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24
	});
}

export const pendingEmail = (cookies: Cookies) => cookies.get(PENDING) ?? '';

export const forgetPending = (cookies: Cookies) => cookies.delete(PENDING, { path: '/' });
