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
		title: 'Word maps',
		icon: 'quote',
		body: 'See the words your whole book is made of at a glance, and a map for each character, drawn from what they say.'
	}
];
