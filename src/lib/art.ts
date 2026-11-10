/**
 * The art shelf's rules (idea 18): what a picture on it is, how big it may be, and how much room
 * each writer has. Shared by the browser, which makes the files, and the server, which checks
 * them, so it imports nothing.
 *
 * Every picture is a JPEG or a PNG, because those are all the PDF can draw; nothing else is
 * stored, so an export never converts one. The browser makes the file and a small copy before
 * sending them, so the server never handles a picture's pixels.
 */

export type ArtSource = 'upload' | 'studio';

/** A picture on the writer's own shelf, as the owner's pages see it. */
export type ArtPicture = {
	id: number;
	url: string;
	/** A copy at most SMALL_SIDE a side, for cards and lists. */
	smallUrl: string;
	width: number;
	height: number;
	/** Both files together. */
	bytes: number;
	source: ArtSource;
	/** The studio drawing it was saved from, in the browser it was made in. */
	draftKey: string | null;
	title: string;
	description: string;
	createdAt: string;
	updatedAt: string;
};

/** What a cover needs to show a picture; a public page is told nothing else about it. */
export type CoverArt = Pick<ArtPicture, 'url' | 'smallUrl' | 'width' | 'height' | 'description'>;

export const coverOf = (picture: ArtPicture): CoverArt => ({
	url: picture.url,
	smallUrl: picture.smallUrl,
	width: picture.width,
	height: picture.height,
	description: picture.description
});

/**
 * How much each writer may keep, both files of every picture together. The user decides the
 * number at launch (see idea 18); this is the one place it's set.
 */
export const ROOM_BYTES = 50 * 1024 * 1024;

/** The longest side a picture is kept at: a 6 × 9 inch page at 300 to the inch is 1800 × 2700. */
export const LONG_SIDE = 2700;
/** The small copy's longest side: a large cover on a phone, at twice the screen's pixels. */
export const SMALL_SIDE = 640;
/** The most one file may be. A PNG over this is sent as a JPEG instead, or made smaller. */
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

export const ART_TYPES = ['image/jpeg', 'image/png'] as const;
export type ArtType = (typeof ART_TYPES)[number];
export const isArtType = (type: unknown): type is ArtType =>
	typeof type === 'string' && (ART_TYPES as readonly string[]).includes(type);
export const extensionOf = (type: ArtType) => (type === 'image/png' ? 'png' : 'jpg');

export const TITLE_LIMIT = 120;
export const DESCRIPTION_LIMIT = 600;

/** How long the browser has to send the files once the server hands out their places. */
export const UPLOAD_MINUTES = 15;

/** Whether the first bytes of a file are what its type says: a PNG's signature or a JPEG's. */
export function looksLike(type: ArtType, head: Uint8Array) {
	if (type === 'image/png') {
		const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		return png.every((byte, index) => head[index] === byte);
	}
	return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

/** A book's cover picture from the shelf, if it has one and it's still there. */
export function coverFrom(pictures: ArtPicture[], id: number | null): CoverArt | null {
	if (id === null) return null;
	const found = pictures.find((picture) => picture.id === id);
	return found ? coverOf(found) : null;
}

/** "1.4 MB", "820 KB": room and sizes as a writer reads them. */
export function formatBytes(bytes: number) {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	const megabytes = bytes / (1024 * 1024);
	return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}
