// Pictures placed in a drawing, to trace over or build on: read from a file on the device or from
// the art shelf, kept at a size the studio can hold, and their pixels made ready to draw.
//
// A picture is kept with the drawing in this browser (see draft.ts), never sent anywhere: one from
// the device isn't uploaded, and one from the shelf is copied, so the drawing keeps it even if the
// shelf's copy goes. What leaves the browser is the finished drawing, when it's saved to the shelf.
//
// Browser only.

import { PICTURE_PIXELS, PICTURE_SIDE } from '$lib/drawing';

export type Picture = {
	/** The file kept with the draft. */
	blob: Blob;
	/** Its pixels, turned the way the camera held it, ready to draw. */
	bitmap: ImageBitmap;
	width: number;
	height: number;
};

/** Files kept as they are; anything else (a GIF, AVIF, HEIC) is saved again as a PNG or JPEG. */
const KEPT = ['image/jpeg', 'image/png', 'image/webp'];

function encode(canvas: HTMLCanvasElement, type: string, quality?: number) {
	return new Promise<Blob>((done, fail) =>
		canvas.toBlob(
			(blob) => (blob ? done(blob) : fail(new Error('This browser couldn’t keep the picture.'))),
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

/**
 * Reads a picture's file. One larger than the studio keeps (PICTURE_SIDE a side, PICTURE_PIXELS in
 * all) is made smaller, and one in a kind not kept is saved again: a PNG when it's see-through, a
 * JPEG when it isn't. A file with no type is tried anyway, as on the shelf.
 */
export async function readPicture(file: Blob): Promise<Picture> {
	if (file.type === 'image/svg+xml' || (file.type && !file.type.startsWith('image/'))) {
		throw new Error('Choose a photograph or a picture: a JPEG, PNG, WebP or GIF.');
	}
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new Error('That file couldn’t be opened as a picture.');
	}
	const { width, height } = bitmap;
	const scale = Math.min(
		1,
		PICTURE_SIDE / Math.max(width, height),
		Math.sqrt(PICTURE_PIXELS / (width * height))
	);
	if (scale >= 1 && KEPT.includes(file.type)) return { blob: file, bitmap, width, height };

	try {
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(width * scale));
		canvas.height = Math.max(1, Math.round(height * scale));
		const context = canvas.getContext('2d');
		if (!context) throw new Error('This browser couldn’t keep the picture.');
		context.imageSmoothingQuality = 'high';
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const clear = file.type !== 'image/jpeg' && seeThrough(canvas);
		const blob = clear
			? await encode(canvas, 'image/png')
			: await encode(canvas, 'image/jpeg', 0.9);
		const smaller = await createImageBitmap(canvas);
		return { blob, bitmap: smaller, width: canvas.width, height: canvas.height };
	} finally {
		bitmap.close();
	}
}

/** A picture from the art shelf, by its address. */
export async function fetchPicture(url: string): Promise<Picture> {
	let response: Response;
	try {
		response = await fetch(url);
	} catch {
		throw new Error('Couldn’t fetch the picture. Check the connection and try again.');
	}
	if (!response.ok) throw new Error('That picture isn’t on your shelf any more.');
	return readPicture(await response.blob());
}

/** A picture's file read back from the draft. Null if the browser can no longer read it. */
export async function restorePicture(blob: Blob): Promise<Picture | null> {
	try {
		const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
		return { blob, bitmap, width: bitmap.width, height: bitmap.height };
	} catch {
		return null;
	}
}
