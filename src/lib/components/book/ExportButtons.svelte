<script lang="ts">
	import { EXPORT_FORMATS, MISSING_HEADER, type ExportFormat } from '$lib/export';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// PDF and Word buttons for a book or a part. The server makes the file, which can take a moment
	// for a long book, so it's fetched here rather than linked: the button can say so, and if
	// anything goes wrong the writer gets a sentence instead of a page of JSON.
	let {
		url,
		what,
		before
	}: {
		/** The export endpoint, without its format. */
		url: string;
		/** "this book", for screen readers. */
		what: string;
		/** Runs first: unsaved text has to reach the server before the file is made. */
		before?: () => Promise<void>;
	} = $props();

	const FORMATS: ExportFormat[] = ['pdf', 'docx'];

	let busy = $state<ExportFormat | null>(null);
	let error = $state('');
	let note = $state('');

	/** The name the server gave the file. */
	function fileName(response: Response, format: ExportFormat) {
		const encoded = response.headers.get('Content-Disposition')?.split("''")[1];
		return encoded ? decodeURIComponent(encoded) : `Book.${EXPORT_FORMATS[format].extension}`;
	}

	async function download(format: ExportFormat) {
		busy = format;
		error = '';
		note = '';
		try {
			await before?.();
			const response = await fetch(`${url}?format=${format}`);
			if (!response.ok) {
				const data = await response.json().catch(() => null);
				throw new Error(data?.error ?? "Couldn't make the file. Try again in a moment.");
			}
			if (response.headers.has(MISSING_HEADER)) {
				note =
					"Some characters aren't in the PDF's typefaces, so they show as question marks. The Word file keeps them.";
			}
			const link = document.createElement('a');
			link.href = URL.createObjectURL(await response.blob());
			link.download = fileName(response, format);
			document.body.append(link);
			link.click();
			link.remove();
			// Long enough for the browser to take the file, however slowly.
			setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
		} catch (err) {
			error = err instanceof Error ? err.message : "Couldn't make the file.";
		} finally {
			busy = null;
		}
	}
</script>

<div class="export">
	{#each FORMATS as format (format)}
		<Button
			disabled={busy !== null}
			aria-label="Export {what} as {EXPORT_FORMATS[format].name}"
			onclick={() => download(format)}
		>
			<Icon name="download" size={15} />{busy === format
				? 'Making it…'
				: EXPORT_FORMATS[format].name}
		</Button>
	{/each}
	<span class="sr-only" role="status"
		>{busy ? `Making the ${EXPORT_FORMATS[busy].name} file` : ''}</span
	>
	{#if error}
		<p class="message error" role="alert"><Icon name="alert-circle" size={15} />{error}</p>
	{/if}
	{#if note}
		<p class="message note"><Icon name="info" size={15} />{note}</p>
	{/if}
</div>

<style>
	.export {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}

	.message {
		flex-basis: 100%;
		display: flex;
		align-items: flex-start;
		gap: 8px;
		font-size: 14px;
		line-height: 1.45;
	}

	.message :global(svg) {
		flex: none;
		margin-top: 2px;
	}

	.error {
		color: var(--bb-coral-soft);
	}

	.note {
		color: var(--bb-text-3);
	}
</style>
