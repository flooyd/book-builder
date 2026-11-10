import {
	isArtType,
	LONG_SIDE,
	MAX_FILE_BYTES,
	SMALL_SIDE,
	type ArtPicture,
	type ArtSource,
	type ArtType
} from '$lib/art';

/**
 * Putting a picture on the art shelf, in the browser (idea 18). The browser does the work so the
 * server never handles pixels: it draws the picture on a canvas at most LONG_SIDE a side, saves
 * it again as a JPEG or a PNG (which also drops what a camera writes into a photograph, such as
 * where it was taken), makes a small copy the same way, and sends both straight to storage.
 *
 * The server's part is two small calls: one hands out where to send the files (/api/art/upload),
 * and one checks they arrived and records them (/api/art).
 */

export type Prepared = {
	picture: Blob;
	small: Blob;
	width: number;
	height: number;
};

function canvasOf(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function encode(canvas: HTMLCanvasElement, type: ArtType, quality?: number) {
	return new Promise<Blob>((done, fail) =>
		canvas.toBlob(
			(blob) =>
				blob && blob.type === type ? done(blob) : fail(new Error('This browser can’t save it.')),
			type,
			quality
		)
	);
}

/** Whether any pixel lets what's behind it show through. */
function seeThrough(canvas: HTMLCanvasElement) {
	const { data } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
	for (let index = 3; index < data.length; index += 4) if (data[index] < 255) return true;
	return false;
}

function scaled(source: CanvasImageSource, width: number, height: number, side: number) {
	const scale = Math.min(1, side / Math.max(width, height));
	const canvas = canvasOf(
		Math.max(1, Math.round(width * scale)),
		Math.max(1, Math.round(height * scale))
	);
	const context = canvas.getContext('2d')!;
	context.imageSmoothingQuality = 'high';
	context.drawImage(source, 0, 0, canvas.width, canvas.height);
	return canvas;
}

/**
 * Make the two files from a picture. `flat` says it's drawn in flat colour (the studio, or an
 * uploaded PNG), so it's kept as a PNG, which keeps edges sharp, unless a JPEG is far smaller.
 * A photograph is a JPEG. Anything that lets the ground show through stays a PNG.
 */
export async function prepare(
	source: CanvasImageSource,
	width: number,
	height: number,
	flat: boolean
): Promise<Prepared> {
	let side = Math.min(LONG_SIDE, Math.max(width, height));
	for (;;) {
		const canvas = scaled(source, width, height, side);
		const clear = seeThrough(canvas);
		let picture: Blob;
		if (clear) {
			picture = await encode(canvas, 'image/png');
		} else {
			const jpeg = await encode(canvas, 'image/jpeg', 0.9);
			const png = flat ? await encode(canvas, 'image/png') : null;
			picture = png && png.size <= MAX_FILE_BYTES && png.size <= jpeg.size * 2 ? png : jpeg;
		}
		if (picture.size > MAX_FILE_BYTES && side > SMALL_SIDE) {
			side = Math.round(side * 0.8);
			continue;
		}
		if (picture.size > MAX_FILE_BYTES) throw new Error('That picture is too big to keep.');
		const copy = scaled(canvas, canvas.width, canvas.height, SMALL_SIDE);
		const small = clear ? await encode(copy, 'image/png') : await encode(copy, 'image/jpeg', 0.85);
		return { picture, small, width: canvas.width, height: canvas.height };
	}
}

/** Kinds of file a writer can choose. Not SVG: it can carry script. */
export const PICK_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

/**
 * Read a chosen file into the two files to send, turned the way the camera held it. A file with
 * no type is tried anyway (some phones' pickers give none, even for a photograph): it's only ever
 * opened as a picture, so anything that isn't one fails there.
 */
export async function prepareFile(file: File) {
	if (file.type === 'image/svg+xml' || (file.type && !file.type.startsWith('image/'))) {
		throw new Error('Choose a photograph or a picture: a JPEG, PNG, WebP or GIF.');
	}
	const photo = file.type === 'image/jpeg' || (!file.type && /\.jpe?g$/i.test(file.name));
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new Error('That file couldn’t be opened as a picture.');
	}
	try {
		return await prepare(bitmap, bitmap.width, bitmap.height, !photo);
	} finally {
		bitmap.close();
	}
}

/** A file's name without its extension, as a first title for the picture. */
export const titleFromFile = (name: string) =>
	name
		.replace(/\.[a-z0-9]{2,5}$/i, '')
		.replace(/[_-]+/g, ' ')
		.trim()
		.slice(0, 120);

type Started = {
	id: string;
	files: ({ path: string; type: ArtType; bytes: number } & ({ token: string } | { url: string }))[];
};

async function call<T>(method: string, url: string, body: unknown): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	const data = await response.json().catch(() => null);
	if (!response.ok) throw new Error(data?.error ?? 'Couldn’t save the picture. Try again.');
	return data as T;
}

export type Details = {
	title?: string;
	description?: string;
	source: ArtSource;
	draftKey?: string | null;
	/** The picture this one takes the place of, keeping its id and every cover it's on. */
	replaces?: number | null;
};

/** Send a prepared picture to storage and put it on the shelf. */
export async function savePicture(prepared: Prepared, details: Details): Promise<ArtPicture> {
	const blobs = [prepared.picture, prepared.small];
	if (!blobs.every((blob) => isArtType(blob.type))) throw new Error('That picture can’t be kept.');
	const started = await call<Started>('POST', '/api/art/upload', {
		files: blobs.map((blob) => ({ type: blob.type, bytes: blob.size })),
		replaces: details.replaces ?? null
	});
	await Promise.all(
		started.files.map(async (target, index) => {
			const blob = blobs[index];
			if ('token' in target) {
				// Loaded only when it's needed, so it isn't part of every page that can save a picture.
				const { put } = await import('@vercel/blob/client');
				await put(target.path, blob, {
					access: 'public',
					token: target.token,
					contentType: target.type
				});
				return;
			}
			// The stand-in on a computer running the app without a storage key.
			const response = await fetch(target.url, {
				method: 'PUT',
				headers: { 'content-type': target.type },
				body: blob
			});
			if (!response.ok) throw new Error('Couldn’t send the picture. Try again.');
		})
	);
	return call<ArtPicture>('POST', '/api/art', {
		uploadId: started.id,
		width: prepared.width,
		height: prepared.height,
		title: details.title,
		description: details.description,
		source: details.source,
		draftKey: details.draftKey ?? null
	});
}
