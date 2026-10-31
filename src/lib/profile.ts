// Author profiles: the rules for a public page's address and an author's website, shared by the
// settings page and the server.

/** 3–30 lowercase letters, digits and dashes, not starting or ending with a dash. */
export const HANDLE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export const handleProblem = (handle: string) =>
	HANDLE.test(handle)
		? null
		: 'Use 3–30 lowercase letters, numbers and dashes (not at the start or end).';

/** An address to suggest from a name: "Maren Toll" → "maren-toll". */
export function suggestHandle(name: string) {
	const slug = name
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 30)
		.replace(/-+$/g, '');
	return slug.length >= 3 ? slug : '';
}

/** A website as typed ("maren.example") made a full http(s) URL, or null if it isn't one. */
export function cleanWebsite(value: string): string | null {
	const text = value.trim();
	if (!text) return '';
	try {
		const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
		if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.')) {
			return null;
		}
		return url.href.length <= 200 ? url.href : null;
	} catch {
		return null;
	}
}

/** "https://maren.example/" shown as "maren.example". */
export const websiteLabel = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
