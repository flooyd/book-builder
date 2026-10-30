import { getContext, setContext, type Snippet } from 'svelte';

export type Crumb = { label: string; href?: string };

/**
 * What the current page wants in the signed-in header. The root layout owns the header and
 * provides this; pages fill it from an `$effect` (see `useAppHeader`) and it is cleared when
 * they unmount. Context keeps it per request on the server.
 */
export class AppHeaderState {
	crumbs = $state<Crumb[]>([]);
	/** Replaces the default right side (Create hint, Log out, avatar) when set. */
	actions = $state<Snippet | null>(null);
	/** Part page uses a wider 1360px frame. */
	wide = $state(false);
}

const KEY = Symbol('app-header');

export function provideAppHeader() {
	return setContext(KEY, new AppHeaderState());
}

/** For the header itself. */
export function getAppHeader() {
	return getContext<AppHeaderState>(KEY);
}

/**
 * Fill the header for the lifetime of the calling component. `configure` runs inside an effect,
 * so it re-runs when the reactive values it reads (titles, save state) change.
 */
export function useAppHeader(configure: (header: AppHeaderState) => void) {
	const header = getAppHeader();

	$effect(() => {
		configure(header);
		return () => {
			header.crumbs = [];
			header.actions = null;
			header.wide = false;
		};
	});
}
