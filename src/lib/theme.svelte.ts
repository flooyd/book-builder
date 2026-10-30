import { getContext, setContext, tick } from 'svelte';

export type Theme = 'light' | 'dark';

/** Remembers the toggle's choice; the server reads it to render <html data-theme> (hooks). */
export const THEME_COOKIE = 'bb-theme';

/** Browser chrome color for each theme (the page background, --bb-night). */
export const THEME_COLOR: Record<Theme, string> = { light: '#F5F0E6', dark: '#0A0F24' };

export function parseTheme(value: string | undefined): Theme | null {
	return value === 'light' || value === 'dark' ? value : null;
}

/**
 * The light/dark theme. Until the toggle is used it follows the OS; the choice is then kept in a
 * cookie for a year. The root layout provides it, so it is per request on the server.
 */
export class ThemeState {
	/** Picked with the toggle, or null to follow the OS. */
	chosen = $state<Theme | null>(null);
	/** The OS preference. Only known in the browser (see `watchSystem`). */
	system = $state<Theme>('dark');
	readonly current = $derived(this.chosen ?? this.system);

	constructor(chosen: Theme | null) {
		this.chosen = chosen;
	}

	/** Tracks the OS preference; call from onMount. Returns the cleanup. */
	watchSystem() {
		const query = matchMedia('(prefers-color-scheme: light)');
		const update = () => (this.system = query.matches ? 'light' : 'dark');
		update();
		query.addEventListener('change', update);
		return () => query.removeEventListener('change', update);
	}

	/**
	 * Switches to the other theme. With `from` (the toggle's center) the new theme is revealed in
	 * a circle growing from that point, where View Transitions are supported and motion is allowed.
	 */
	toggle(from?: { x: number; y: number }) {
		const next: Theme = this.current === 'light' ? 'dark' : 'light';
		const root = document.documentElement;
		const apply = () => {
			this.chosen = next;
			root.dataset.theme = next;
			document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
		};

		if (
			!from ||
			!document.startViewTransition ||
			matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			apply();
			return;
		}

		root.classList.add('theme-switching');
		const transition = document.startViewTransition(async () => {
			apply();
			await tick();
		});
		const done = () => root.classList.remove('theme-switching');
		transition.ready.then(() => {
			const radius = Math.hypot(
				Math.max(from.x, innerWidth - from.x),
				Math.max(from.y, innerHeight - from.y)
			);
			root.animate(
				{
					clipPath: [
						`circle(0px at ${from.x}px ${from.y}px)`,
						`circle(${radius}px at ${from.x}px ${from.y}px)`
					]
				},
				{
					duration: 520,
					easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
					pseudoElement: '::view-transition-new(root)'
				}
			);
		}, done);
		// A skipped transition (another one started) still applies the theme.
		transition.finished.then(done, done);
	}
}

const KEY = Symbol('theme');

export function provideTheme(chosen: Theme | null) {
	return setContext(KEY, new ThemeState(chosen));
}

export function getTheme() {
	return getContext<ThemeState>(KEY);
}
