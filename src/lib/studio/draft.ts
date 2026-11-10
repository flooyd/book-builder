// Drafts: a drawing kept in this browser (IndexedDB) as it's made, so a reload or a crash loses
// nothing. Nothing here touches the server; a drawing goes there only when the writer saves it.
// Each draft belongs to the account that made it, so two people sharing a browser don't see each
// other's.
//
// Browser only.

import { cleanDrawing, newId, type Drawing } from '$lib/drawing';

const NAME = 'bb-studio';
const VERSION = 1;

export type DraftInfo = {
	key: string;
	owner: string;
	title: string;
	width: number;
	height: number;
	updatedAt: number;
	/** A small picture for the shelf. */
	thumb: Blob | null;
};

type DraftRecord = DraftInfo & { doc: Drawing };
type PixelRecord = { draft: string; layer: string; blob: Blob };

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	database ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(NAME, VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains('drafts')) {
				db.createObjectStore('drafts', { keyPath: 'key' }).createIndex('owner', 'owner');
			}
			if (!db.objectStoreNames.contains('pixels')) {
				db.createObjectStore('pixels', { keyPath: ['draft', 'layer'] }).createIndex(
					'draft',
					'draft'
				);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			database = null;
			reject(request.error);
		};
	});
	return database;
}

function result<T>(request: IDBRequest<T>) {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function finished(transaction: IDBTransaction) {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = transaction.onabort = () => reject(transaction.error);
	});
}

export const newDraftKey = () => `d${newId()}`;

/** This account's drafts, newest first, without their drawings. */
export async function listDrafts(owner: string): Promise<DraftInfo[]> {
	const db = await open();
	const records = await result<DraftRecord[]>(
		db.transaction('drafts').objectStore('drafts').index('owner').getAll(owner)
	);
	return records
		.map(({ key, title, width, height, updatedAt, thumb }) => ({
			key,
			owner,
			title,
			width,
			height,
			updatedAt,
			thumb
		}))
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** A draft and its paint layers' pixels, or null if there's no such draft for this account. */
export async function readDraft(key: string, owner: string) {
	const db = await open();
	const transaction = db.transaction(['drafts', 'pixels']);
	const record = await result<DraftRecord | undefined>(transaction.objectStore('drafts').get(key));
	if (!record || record.owner !== owner) return null;
	const doc = cleanDrawing(record.doc);
	if (!doc) return null;
	const stored = await result<PixelRecord[]>(
		transaction.objectStore('pixels').index('draft').getAll(key)
	);
	const pixels = new Map(stored.map((item) => [item.layer, item.blob]));
	return { info: { ...record, doc: undefined } as DraftInfo, doc, pixels };
}

/** Keeps a draft's drawing (and picture). */
export async function writeDraft(info: DraftInfo, doc: Drawing) {
	const db = await open();
	const transaction = db.transaction('drafts', 'readwrite');
	transaction.objectStore('drafts').put({ ...info, doc } satisfies DraftRecord);
	await finished(transaction);
}

/** Keeps paint layers' pixels, and forgets those of layers the drawing no longer has. */
export async function writePixels(
	key: string,
	changed: Iterable<[layer: string, blob: Blob]>,
	keep: string[]
) {
	const db = await open();
	const transaction = db.transaction('pixels', 'readwrite');
	const store = transaction.objectStore('pixels');
	for (const [layer, blob] of changed) store.put({ draft: key, layer, blob } satisfies PixelRecord);
	const stored = await result<IDBValidKey[]>(store.index('draft').getAllKeys(key));
	for (const id of stored) {
		const layer = (id as [string, string])[1];
		if (!keep.includes(layer)) store.delete(id);
	}
	await finished(transaction);
}

export async function deleteDraft(key: string) {
	const db = await open();
	const transaction = db.transaction(['drafts', 'pixels'], 'readwrite');
	transaction.objectStore('drafts').delete(key);
	const pixels = transaction.objectStore('pixels');
	const keys = await result<IDBValidKey[]>(pixels.index('draft').getAllKeys(key));
	for (const id of keys) pixels.delete(id);
	await finished(transaction);
}

/** Makes a new, empty draft and returns its key. */
export async function createDraft(owner: string, title: string, doc: Drawing) {
	const key = newDraftKey();
	await writeDraft(
		{ key, owner, title, width: doc.width, height: doc.height, updatedAt: Date.now(), thumb: null },
		doc
	);
	return key;
}
