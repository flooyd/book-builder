import type { IconName } from '$lib/components/ui/Icon.svelte';

/**
 * Features on the home page's "Coming soon" shelf. While it's empty, the section and its link
 * in the site header are left out.
 */
export const SOON: { title: string; icon: IconName; body: string }[] = [
	{
		title: 'Writing Goals',
		icon: 'target',
		body: 'Daily and per-book word targets, streaks to keep, and a countdown to your deadline.'
	},
	{
		title: 'Focus Mode',
		icon: 'focus',
		body: 'A full-screen page with nothing but your words, typewriter scrolling and a session timer.'
	},
	{
		title: 'Author Profiles',
		icon: 'user',
		body: 'A private page for your name and settings, and a public one with the books you share.'
	}
];
