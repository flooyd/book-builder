import { json, type RequestEvent } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth-guard';
import { exportResponse, partManuscript, requestedFormat } from '$lib/server/export';
import { findOwnedBook, findOwnedPart } from '$lib/server/ownership';
import { readableBook } from '$lib/server/reading';

// A long book takes a while to set, and this gives the export its own function, which keeps the
// typefaces and the typesetting out of the one that serves every page.
export const config = { maxDuration: 60 };

/** Download one part with its chapters: `?format=pdf` or `?format=docx`. */
export const GET = async (event: RequestEvent) => {
	const user = requireUser(event);
	const id = Number(event.params.partId);
	if (!Number.isInteger(id)) return json({ error: 'Invalid part id' }, { status: 400 });
	const found = await findOwnedPart(user.id, id);
	const book = found && (await findOwnedBook(user.id, found.bookId));
	if (!book) return json({ error: 'Part not found' }, { status: 404 });

	const format = requestedFormat(event.url);
	if (format instanceof Response) return format;
	const manuscript = partManuscript(await readableBook(book), id);
	if (!manuscript) return json({ error: 'Part not found' }, { status: 404 });
	return exportResponse(manuscript, format);
};
