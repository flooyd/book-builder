import { beforeNavigate } from '$app/navigation';
import { countWords } from '$lib/reading';
import { plainText } from '$lib/rich';
import { recordWriting, touchLibrary } from '$lib/library';

type Status = 'loading' | 'load-error' | 'ready' | 'saving' | 'saved' | 'error';

/**
 * The story text of a part that has no chapters, or of a chapter. POST vs PUT is decided by
 * whether a row exists (not by whether the text is empty, which made clearing the text
 * impossible), and nothing is written until the writer saves.
 */
export class StoryTextDoc {
	/** Plain text, or the rich editor's document as JSON (see $lib/rich). */
	content = $state('');
	/** Last value known to be on the server. */
	saved = $state('');
	status = $state<Status>('loading');
	error = $state('');

	readonly dirty = $derived(
		this.status !== 'loading' && this.status !== 'load-error' && this.content !== this.saved
	);
	readonly words = $derived(countWords(plainText(this.content)));
	/** Words in the last saved version, so the unsaved part is `words - savedWords`. */
	readonly savedWords = $derived(countWords(plainText(this.saved)));
	/** Set by the editor: hands over typing it hasn't reported yet. */
	flush: (() => void) | null = null;

	#exists = false;
	#loading: Promise<void> | null = null;
	#target: 'part' | 'chapter';
	#id: number;
	#url: string;

	constructor(target: 'part' | 'chapter', id: number) {
		this.#target = target;
		this.#id = id;
		this.#url = `/api/story-text/${target}/${id}`;
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
		this.flush?.();
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
			// "Updated today" on the chapter, its part and its book, wherever they're listed.
			const { touchedAt, writing } = await response.json().catch(() => ({}));
			if (touchedAt) touchLibrary(this.#target, this.#id, touchedAt);
			if (writing) recordWriting(this.#target, this.#id, writing);
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

/**
 * Ctrl/Cmd+S saves, and leaving with unsaved text asks first. A 'leave' navigation (reload,
 * close, external link) shows the browser's own beforeunload prompt when cancelled. Call during
 * component initialisation.
 */
export function guardStoryText(doc: StoryTextDoc, enabled: () => boolean = () => true) {
	beforeNavigate(({ type, cancel }) => {
		doc.flush?.();
		if (!enabled() || !doc.dirty) return;
		if (type === 'leave') cancel();
		else if (!confirm('You have unsaved changes to this story text. Leave without saving?'))
			cancel();
	});

	$effect(() => {
		function onkeydown(event: KeyboardEvent) {
			// Not with Shift: Ctrl+Shift+S is the editor's strikethrough.
			if (
				enabled() &&
				(event.ctrlKey || event.metaKey) &&
				!event.shiftKey &&
				event.key.toLowerCase() === 's'
			) {
				event.preventDefault();
				doc.save();
			}
		}
		window.addEventListener('keydown', onkeydown);
		return () => window.removeEventListener('keydown', onkeydown);
	});
}

async function errorText(response: Response) {
	const body = await response.json().catch(() => null);
	return body?.error ?? body?.message ?? `Request failed (${response.status}).`;
}

function message(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}
