import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { THEME_COOKIE, parseTheme } from '$lib/theme.svelte';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Render the chosen theme on <html> (app.html's %bb.theme%) so the first paint is right. With no
// choice yet, the CSS follows the OS.
const handleTheme: Handle = ({ event, resolve }) => {
	const theme = parseTheme(event.cookies.get(THEME_COOKIE));
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%bb.theme%', theme ? `data-theme="${theme}"` : '')
	});
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	// Better Auth gives an unconfirmed account no session to begin with; this makes sure one never
	// counts as signed in, so nothing in the app opens before the email is confirmed.
	if (session?.user.emailVerified) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = sequence(handleTheme, handleBetterAuth);
