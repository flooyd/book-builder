import type { LayoutServerLoad } from './$types';
import { THEME_COOKIE, parseTheme } from '$lib/theme.svelte';

export const load: LayoutServerLoad = (event) => {
	return {
		user: event.locals.user ?? null,
		theme: parseTheme(event.cookies.get(THEME_COOKIE))
	};
};
