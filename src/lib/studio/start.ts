import {
	newDrawing,
	newId,
	newLayer,
	type Drawing,
	type ImageShape,
	type VectorLayer
} from '$lib/drawing';
import { createDraft } from './draft';
import type { Picture } from './pictures';
import { thumbnail } from './render';

// Starting a drawing from a picture: the drawing takes the picture's size, the picture sits on a
// locked layer of its own at the bottom, and an empty layer above it is the one to draw on. Painting
// on the picture itself waits for brushes (piece b of idea 25).

/** The drawing a picture starts, and the id the picture is kept under in it. */
export function drawingFromPicture(picture: Picture, name: string): { doc: Drawing; id: string } {
	const doc = newDrawing(picture.width, picture.height, null);
	const id = newId();
	const shape: ImageShape = {
		id: newId(),
		name,
		transform: [1, 0, 0, 1, 0, 0],
		opacity: 1,
		hidden: false,
		locked: false,
		kind: 'image',
		picture: id,
		width: doc.width,
		height: doc.height
	};
	const bottom: VectorLayer = {
		...(newLayer('vector', 'Picture') as VectorLayer),
		locked: true,
		shapes: [shape]
	};
	return { doc: { ...doc, layers: [bottom, ...doc.layers] }, id };
}

/** Makes the drawing in this browser and returns its draft's key. */
export async function startFromPicture(owner: string, picture: Picture, name: string) {
	const { doc, id } = drawingFromPicture(picture, name);
	// Its card on the studio's shelf shows the picture straight away, not a blank.
	const small = thumbnail({ doc, paint: new Map(), pictures: new Map([[id, picture]]) });
	const thumb = await new Promise<Blob | null>((done) => small.toBlob(done, 'image/webp', 0.86));
	return createDraft(owner, name || 'From a picture', doc, [[id, picture.blob]], thumb);
}
