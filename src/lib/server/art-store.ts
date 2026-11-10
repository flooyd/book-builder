import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BlobNotFoundError, del, head } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { extensionOf, UPLOAD_MINUTES, type ArtType } from '$lib/art';

/**
 * Where the art shelf's files live (idea 18), behind four calls: a place to upload to, a look at
 * what arrived, a delete and a read. Everything else talks to this, never to storage itself.
 *
 * - **Vercel Blob**, a public store, when BLOB_READ_WRITE_TOKEN is set. A browser sends each file
 *   straight to it with a token that allows one path, one type and a set number of bytes, and
 *   readers fetch pictures from Vercel's CDN with no work here. The store is never listed (a
 *   listing costs as much as an upload): the `art` table is the index.
 * - **A folder on this computer** when there is no token and the dev server is running, the way
 *   email prints to the terminal without RESEND_API_KEY. It keeps test pictures out of the real
 *   store. ART_STORE_DIR says where; /api/art/local serves and takes the files.
 * - **Nothing**, on a deployed site without a token: uploads say they aren't available yet.
 */

export type StoreMode = 'blob' | 'local' | 'off';

const token = () => env.BLOB_READ_WRITE_TOKEN || '';

export function storeMode(): StoreMode {
	if (token()) return 'blob';
	return dev ? 'local' : 'off';
}

/** The stand-in's addresses start here; a stored URL that does is a file in the local folder. */
export const LOCAL_PREFIX = '/api/art/local/';

/**
 * New, unguessable places for a picture and its small copy, e.g. `art/Hc0…Zq.png` and
 * `art/Hc0…Zq-small.jpg`. Nothing in them says whose they are.
 */
export function newPaths(picture: ArtType, small: ArtType) {
	const name = `art/${randomBytes(18).toString('base64url')}`;
	return [`${name}.${extensionOf(picture)}`, `${name}-small.${extensionOf(small)}`];
}

/** Only paths this module makes are ever read or written, so a path can't climb out. */
const SAFE_PATH = /^art\/[A-Za-z0-9_-]{24}(-small)?\.(png|jpg)$/;
export const isStorePath = (value: unknown): value is string =>
	typeof value === 'string' && SAFE_PATH.test(value);

export type UploadTarget = { path: string; type: ArtType; bytes: number } & (
	{ token: string } | { url: string }
);

/** Where the browser sends one file, allowing that path, that type and no more than `bytes`. */
export async function uploadTarget(
	filePath: string,
	type: ArtType,
	bytes: number
): Promise<UploadTarget> {
	if (storeMode() === 'local') return { path: filePath, type, bytes, url: LOCAL_PREFIX + filePath };
	const clientToken = await generateClientTokenFromReadWriteToken({
		token: token(),
		pathname: filePath,
		allowedContentTypes: [type],
		maximumSizeInBytes: bytes,
		validUntil: Date.now() + UPLOAD_MINUTES * 60_000,
		addRandomSuffix: false,
		allowOverwrite: false
	});
	return { path: filePath, type, bytes, token: clientToken };
}

export type Arrived = { url: string; bytes: number; type: string };

/** What storage really holds at a path, or null when nothing arrived. */
export async function inspect(filePath: string): Promise<Arrived | null> {
	if (!isStorePath(filePath)) return null;
	if (storeMode() === 'local') {
		const found = await stat(localFile(filePath)).catch(() => null);
		if (!found?.isFile()) return null;
		return { url: LOCAL_PREFIX + filePath, bytes: found.size, type: localType(filePath) };
	}
	try {
		const blob = await head(filePath, { token: token() });
		return { url: blob.url, bytes: blob.size, type: blob.contentType };
	} catch (error) {
		if (error instanceof BlobNotFoundError) return null;
		throw error;
	}
}

/**
 * Delete files by their stored URLs, or by the paths handed out for an upload, which belong to
 * whichever store is in use. Files that are already gone are fine. A local file is only touched
 * while the stand-in is in use.
 */
export async function remove(addresses: string[]) {
	const local: string[] = [];
	const stored: string[] = [];
	for (const address of addresses) {
		if (address.startsWith(LOCAL_PREFIX)) local.push(address.slice(LOCAL_PREFIX.length));
		else if (isStorePath(address)) (storeMode() === 'local' ? local : stored).push(address);
		else if (isBlobURL(address)) stored.push(address);
	}
	if (storeMode() === 'local') {
		for (const filePath of local) {
			if (isStorePath(filePath)) await rm(localFile(filePath), { force: true });
		}
	}
	if (!stored.length) return;
	if (!token()) throw new Error('Pictures can’t be deleted without the storage key.');
	// Blob takes up to a thousand at a time.
	for (let start = 0; start < stored.length; start += 1000) {
		await del(stored.slice(start, start + 1000), { token: token() });
	}
}

/** A picture's bytes, for an export. Null if it's missing or isn't where pictures are kept. */
export async function readPicture(url: string): Promise<Uint8Array | null> {
	if (url.startsWith(LOCAL_PREFIX)) {
		const filePath = url.slice(LOCAL_PREFIX.length);
		if (!isStorePath(filePath) || storeMode() !== 'local') return null;
		return readFile(localFile(filePath)).catch(() => null);
	}
	if (!isBlobURL(url)) return null;
	const response = await fetch(url).catch(() => null);
	if (!response?.ok) return null;
	return new Uint8Array(await response.arrayBuffer());
}

/** A public Blob address: https, on Vercel's storage domain, at a path this module made. */
function isBlobURL(address: string) {
	try {
		const url = new URL(address);
		return (
			url.protocol === 'https:' &&
			url.hostname.endsWith('.public.blob.vercel-storage.com') &&
			isStorePath(url.pathname.slice(1))
		);
	} catch {
		return false;
	}
}

// The stand-in's folder.

function localRoot() {
	return env.ART_STORE_DIR || path.join(tmpdir(), 'book-builder-art');
}

function localFile(filePath: string) {
	return path.join(localRoot(), ...filePath.split('/'));
}

export function localType(filePath: string): ArtType {
	return filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
}

/** Keep a file the browser sent to the stand-in. */
export async function writeLocal(filePath: string, bytes: Uint8Array) {
	if (storeMode() !== 'local' || !isStorePath(filePath)) throw new Error('Not a local path');
	const file = localFile(filePath);
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, bytes, { flag: 'wx' }); // never over another file, as Blob is told
}

export async function readLocal(filePath: string) {
	if (storeMode() !== 'local' || !isStorePath(filePath)) return null;
	return readFile(localFile(filePath)).catch(() => null);
}
