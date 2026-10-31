import type { IconName } from '$lib/components/ui/Icon.svelte';

/**
 * Features on the home page's "Coming soon" shelf. While it's empty, the section and its link
 * in the site header are left out.
 */
export const SOON: { title: string; icon: IconName; body: string }[] = [
	{
		title: 'Export',
		icon: 'download',
		body: 'Download a finished book as a PDF or a Word document, with its cover, parts and chapters in order.'
	},
	{
		title: 'Mentions',
		icon: 'at-sign',
		body: 'Type @ to link a character in your story text, hover for their card, and see every chapter they appear in.'
	}
];
