import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { bookManuscript, exportResponse, requestedFormat } from '$lib/server/export';
import { findOwnedBook } from '$lib/server/ownership';
import { readableBook } from '$lib/server/reading';

// A long book takes a while to set, and this gives the export its own function, which keeps the
// typefaces and the typesetting out of the one that serves every page.
export const config = { maxDuration: 60 };

/** Download a whole book: `?format=pdf` or `?format=docx`. */
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) return json({ error: 'Invalid book id' }, { status: 400 });
	const found = await findOwnedBook(user.id, id);
	if (!found) return json({ error: 'Book not found' }, { status: 404 });

	const format = requestedFormat(event.url);
	if (format instanceof Response) return format;
	return exportResponse(bookManuscript(await readableBook(found)), format);
};
