import { error } from '@sveltejs/kit';
import { HANDLE } from '$lib/profile';
import { publicSeries } from '$lib/server/series';
import type { PageServerLoad } from './$types';

// A series on an author's public page: anyone can see it once a book in it is shared.
export const load: PageServerLoad = async ({ params }) => {
	const handle = params.handle.toLowerCase();
	const id = Number(params.id);
	const series =
		HANDLE.test(handle) && Number.isInteger(id) ? await publicSeries(handle, id) : null;
	if (!series) error(404, "There's no public series here.");
	return { series, handle, id };
};
