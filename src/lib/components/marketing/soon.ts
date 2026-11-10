import type { IconName } from '$lib/components/ui/Icon.svelte';

/**
 * Features on the home page's "Coming soon" shelf. While it's empty, the section and its link
 * in the site header are left out.
 */
export const SOON: { title: string; icon: IconName; body: string }[] = [
	{
		title: 'Find and replace',
		icon: 'search',
		body: 'Change a word or a name across your whole book at once, with a look at every match first.'
	}
];
