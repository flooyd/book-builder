type Status = 'loading' | 'load-error' | 'ready' | 'saving' | 'saved' | 'error';

export function countWords(text: string) {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * The story text of a part that has no chapters. POST vs PUT is decided by whether a row exists
 * (not by whether the text is empty, which made clearing the text impossible), and nothing is
 * written until the writer saves.
 */
export class StoryTextDoc {
	content = $state('');
	/** Last value known to be on the server. */
	saved = $state('');
	status = $state<Status>('loading');
	error = $state('');

	readonly dirty = $derived(
		this.status !== 'loading' && this.status !== 'load-error' && this.content !== this.saved
	);
	readonly words = $derived(countWords(this.content));

	#exists = false;
	#loading: Promise<void> | null = null;
	#url: string;

	constructor(partId: number) {
		this.#url = `/api/story-text/part/${partId}`;
	}

	load() {
		this.#loading ??= this.#load();
		return this.#loading;
	}

	async #load() {
		this.status = 'loading';
		try {
			const response = await fetch(this.#url);
			if (!response.ok) throw new Error(await errorText(response));
			const rows: { content: string }[] = await response.json();
			this.#exists = rows.length > 0;
			this.saved = this.content = rows[0]?.content ?? '';
			this.status = 'ready';
		} catch (error) {
			this.error = message(error, "Couldn't load the story text.");
			this.status = 'load-error';
			this.#loading = null; // allow a retry
		}
	}

	async save() {
		if (this.status === 'loading' || this.status === 'load-error' || this.status === 'saving')
			return;
		const content = this.content;
		this.status = 'saving';
		this.error = '';
		try {
			let response = await this.#send(this.#exists ? 'PUT' : 'POST', content);
			// The row appeared (or vanished) since we loaded: retry with the other method once.
			if ((!this.#exists && response.status === 400) || (this.#exists && response.status === 404)) {
				this.#exists = !this.#exists;
				response = await this.#send(this.#exists ? 'PUT' : 'POST', content);
			}
			if (!response.ok) throw new Error(await errorText(response));
			this.#exists = true;
			this.saved = content;
			this.status = 'saved';
		} catch (error) {
			this.error = message(error, "Couldn't save the story text.");
			this.status = 'error';
		}
	}

	#send(method: 'POST' | 'PUT', content: string) {
		return fetch(this.#url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ content })
		});
	}
}

async function errorText(response: Response) {
	const body = await response.json().catch(() => null);
	return body?.error ?? body?.message ?? `Request failed (${response.status}).`;
}

function message(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
