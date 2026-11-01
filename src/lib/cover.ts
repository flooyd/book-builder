/**
 * A book's generated cover (books have no image field), shared by BookCover on the page and the
 * exported PDF. The variant comes from a stable hash of the id, so a book keeps its cover.
 */

function hash(text: string) {
	let h = 0;
	for (const char of text) h = (h * 31 + char.charCodeAt(0)) | 0;
	return Math.abs(h);
}

export const coverVariant = (id: number) => (hash(String(id)) % 2 === 1 ? 'navy' : 'paper');

/** Long titles step down so they stay on the cover. */
export const coverTitleScale = (title: string) =>
	title.length > 30 ? 0.7 : title.length > 16 ? 0.84 : 1;
