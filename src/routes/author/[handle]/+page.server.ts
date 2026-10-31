import { error } from '@sveltejs/kit';
import { publicAuthor } from '$lib/server/profile';
import { HANDLE } from '$lib/profile';
import type { PageServerLoad } from './$types';

// An author's public page: anyone can see it once the author turns it on.
export const load: PageServerLoad = async ({ params }) => {
	const handle = params.handle.toLowerCase();
	const author = HANDLE.test(handle) ? await publicAuthor(handle) : null;
	if (!author) error(404, "There's no public author page here.");
	return { author, handle };
};
