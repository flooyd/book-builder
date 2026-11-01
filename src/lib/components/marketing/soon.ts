import type { IconName } from '$lib/components/ui/Icon.svelte';

/**
 * Features on the home page's "Coming soon" shelf. While it's empty, the section and its link
 * in the site header are left out.
 */
export const SOON: { title: string; icon: IconName; body: string }[] = [
	{
		title: 'Your account',
		icon: 'lock',
		body: 'Reset a forgotten password by email, and delete your account whenever you choose.'
	},
	{
		title: 'Series',
		icon: 'layers',
		body: 'Tie your books together with a reading order, a shared story bible and a series page on your author profile.'
	},
	{
		title: 'Manuscript insights',
		icon: 'search',
		body: 'See your overused words, your chapter pacing and the characters who vanish for too long, with no AI involved.'
	}
];
