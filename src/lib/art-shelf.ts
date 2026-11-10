import { get } from 'svelte/store';
import type { ArtPicture } from '$lib/art';
import {
	prepareFile,
	savePicture,
	titleFromFile,
	type Details,
	type Prepared
} from '$lib/art-upload';
import { putJSON, sendJSON } from '$lib/library';
import { artStore, artUploadsOpen, booksStore, type Book } from '$lib/stores';

/**
 * The art shelf in the browser: putting pictures on it, taking them off, and putting them on
 * covers, keeping the stores in step with what the server says. Shared by the shelf, the cover
 * picker on a book's page and the studio's "Save to shelf".
 */

/** Bytes the shelf holds, from what's loaded (uploads under way aren't counted here). */
export const usedBytes = (pictures: ArtPicture[]) =>
	pictures.reduce((sum, picture) => sum + picture.bytes, 0);

/** Fetch the shelf again, with whether uploads work, e.g. when its page opens. */
export async function refreshShelf() {
	const response = await fetch('/api/art');
	if (!response.ok) throw new Error('Couldn’t load your pictures.');
	const data = (await response.json()) as { pictures: ArtPicture[]; uploads: boolean };
	artStore.set(data.pictures);
	artUploadsOpen.set(data.uploads);
	return data;
}

function keep(picture: ArtPicture) {
	artStore.update((list) =>
		list.some((item) => item.id === picture.id)
			? list.map((item) => (item.id === picture.id ? picture : item))
			: [picture, ...list]
	);
	return picture;
}

/** Upload a picture the writer chose. */
export async function uploadFile(file: File) {
	const prepared = await prepareFile(file);
	return keep(await savePicture(prepared, { source: 'upload', title: titleFromFile(file.name) }));
}

/** Save prepared files (the studio's drawing) to the shelf, or in place of the picture named. */
export async function savePrepared(prepared: Prepared, details: Details) {
	return keep(await savePicture(prepared, details));
}

export async function describePicture(
	id: number,
	changes: { title?: string; description?: string }
) {
	return keep(await sendJSON<ArtPicture>('PUT', `/api/art/${id}`, changes));
}

/** Take a picture off the shelf; any cover it was on is drawn from the title again. */
export async function deletePicture(id: number) {
	await sendJSON('DELETE', `/api/art/${id}`);
	artStore.update((list) => list.filter((item) => item.id !== id));
	booksStore.update((list) =>
		list.map((book) => (book.coverArtId === id ? { ...book, coverArtId: null } : book))
	);
}

/** Put a picture on a book's cover, or null to draw it from the title again. */
export async function setCover(bookId: number, artId: number | null) {
	const updated = await putJSON<Book>(`/api/book/${bookId}/cover`, { artId });
	booksStore.update((list) => list.map((book) => (book.id === bookId ? updated : book)));
	return updated;
}

/** The books a picture is the cover of. */
export const coversWith = (books: Book[], id: number) =>
	books.filter((book) => book.coverArtId === id);

/** The picture on the shelf saved from a studio drawing, if there is one. */
export const savedFrom = (draftKey: string) =>
	get(artStore).find((picture) => picture.draftKey === draftKey) ?? null;
