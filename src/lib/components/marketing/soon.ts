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
		title: 'Find and replace',
		icon: 'search',
		body: 'Change a word or a name across your whole book at once, with a look at every match first.'
	},
	{
		title: 'Connections map',
		icon: 'users',
		body: "See your story bible as a web: who's family, who's a rival and who owes whom."
	}
];
