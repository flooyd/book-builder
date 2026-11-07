import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { auth } from '$lib/server/auth';
import { THEME_COOKIE, parseTheme } from '$lib/theme.svelte';

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

	// Better Auth's own addresses, such as the links in its emails. Its svelteKitHandler only takes
	// them when the request's site is exactly ORIGIN, so the site's other addresses (with or without
	// www, the vercel.app one) would get a 404. Going by the path, every address works.
	if (event.url.pathname.startsWith('/api/auth/')) return auth.handler(event.request);
	return resolve(event);
};

export const handle: Handle = sequence(handleTheme, handleBetterAuth);
