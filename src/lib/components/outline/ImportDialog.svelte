<script lang="ts">
	import { plural } from '$lib/library';
	import { parseOutline, type ParsedOutline } from '$lib/outline-text';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// Paste a plain-text outline; a preview shows what will be added before anything is created.
	let {
		holders,
		onimport,
		onclose
	}: {
		/** Parts that hold chapters, for chapters that come before the first part line. */
		holders: { id: number; label: string; title: string }[];
		onimport: (parsed: ParsedOutline, intoPartId: number | null) => Promise<boolean>;
		onclose: () => void;
	} = $props();

	let text = $state('');
	// svelte-ignore state_referenced_locally
	let into = $state(holders.at(-1) ? String(holders.at(-1)!.id) : '');
	let busy = $state(false);

	const parsed = $derived(parseOutline(text));
	const chapterCount = $derived(
		parsed.chapters.length + parsed.parts.reduce((sum, part) => sum + part.chapters.length, 0)
	);
	// Chapters before any part line need somewhere to go: an existing part, or a new one.
	const needsPart = $derived(parsed.chapters.length > 0 && holders.length === 0);
	const total = $derived(parsed.parts.length + chapterCount);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (total === 0 || busy) return;
		busy = true;
		const payload: ParsedOutline = needsPart
			? {
					chapters: [],
					parts: [
						{
							title: 'Untitled part',
							description: '',
							hasChapters: true,
							chapters: parsed.chapters
						},
						...parsed.parts
					]
				}
			: parsed;
		const done = await onimport(payload, payload.chapters.length ? Number(into) : null);
		busy = false;
		if (done) onclose();
	}

	const example = `# Part One — The Drowned Moon
Salvage Rights — Juno answers a three-hundred-year-old call
A Map of Dead Stars
> Interlude
# Part Two
Ghostlight`;
</script>

<Dialog labelledby="import-title" width={760} {onclose}>
	<form class="import" onsubmit={submit}>
		<div class="head">
			<h2 id="import-title">Import from text</h2>
			<button type="button" class="close" aria-label="Close" onclick={onclose}>
				<Icon name="x" size={20} />
			</button>
		</div>
		<p class="intro">
			Paste or type an outline. Lines starting with <code>#</code> are parts,
			<code>&gt;</code> a part with its own story text (like a prologue), and every other line is a
			chapter. Text after <code>—</code> or <code>--</code> becomes the synopsis.
		</p>

		<div class="panes">
			<div class="pane">
				<label for="import-text">Outline</label>
				<textarea
					id="import-text"
					class="bb-field"
					bind:value={text}
					rows="12"
					placeholder={example}></textarea>
			</div>

			<div class="pane">
				<p class="pane-label" id="import-preview">Preview</p>
				<div class="preview" aria-labelledby="import-preview" role="region">
					{#if total === 0}
						<p class="muted">Nothing yet.</p>
					{:else}
						{#if parsed.chapters.length > 0}
							<p class="into-note">
								{plural(parsed.chapters.length, 'chapter')} into {needsPart
									? 'a new part'
									: 'the part chosen below'}
							</p>
							<ol class="chapters">
								{#each parsed.chapters as chapter, i (i)}<li>{chapter.title}</li>{/each}
							</ol>
						{/if}
						{#each parsed.parts as part, i (i)}
							<p class="part">
								<span class="kind">{part.hasChapters ? 'Part' : 'Story text'}</span>{part.title}
							</p>
							{#if part.description}<p class="synopsis">{part.description}</p>{/if}
							{#if part.chapters.length > 0}
								<ol class="chapters">
									{#each part.chapters as chapter, j (j)}
										<li>
											{chapter.title}{#if chapter.description}<span class="synopsis">
													— {chapter.description}</span
												>{/if}
										</li>
									{/each}
								</ol>
							{/if}
						{/each}
					{/if}
				</div>
			</div>
		</div>

		{#if parsed.chapters.length > 0 && !needsPart}
			<div class="into">
				<label for="import-into">Chapters before the first part go into</label>
				<select id="import-into" class="bb-field" bind:value={into}>
					{#each holders as holder (holder.id)}
						<option value={String(holder.id)}>{holder.label} · {holder.title}</option>
					{/each}
				</select>
			</div>
		{/if}

		<div class="footer">
			<span class="summary"
				>{total === 0
					? ''
					: `Adds ${plural(parsed.parts.length + (needsPart ? 1 : 0), 'part')} and ${plural(chapterCount, 'chapter')}`}</span
			>
			<div class="footer-actions">
				<Button variant="quiet" onclick={onclose}>Cancel</Button>
				<Button type="submit" variant="primary" disabled={total === 0 || busy}>
					<Icon name="plus" size={16} strokeWidth={2.2} />{busy ? 'Adding…' : 'Add to outline'}
				</Button>
			</div>
		</div>
	</form>
</Dialog>

<style>
	.import {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 22px 26px 24px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 32px;
		color: var(--bb-text-strong);
	}

	.close {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--bb-text-2);
	}

	.close:hover {
		background: var(--bb-raised);
	}

	.intro {
		font-size: 15px;
		line-height: 1.55;
		color: var(--bb-text-2);
	}

	code {
		padding: 1px 6px;
		border-radius: 5px;
		background: var(--bb-raised);
		font-size: 0.92em;
		color: var(--bb-text);
	}

	.panes {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
		gap: 16px;
	}

	.pane {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	label,
	.pane-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	textarea.bb-field {
		min-height: 260px;
		font:
			15px/1.6 ui-monospace,
			'Cascadia Mono',
			Menlo,
			monospace;
		background: var(--bb-night);
	}

	.preview {
		height: 290px;
		overflow: auto;
		padding: 12px 14px;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-night);
	}

	.part {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-top: 10px;
		font-family: var(--font-display);
		font-size: 19px;
		color: var(--bb-text-strong);
	}

	.part:first-child {
		margin-top: 0;
	}

	.kind {
		font: 700 10.5px var(--font-ui);
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.chapters {
		margin: 4px 0 0;
		padding-left: 26px;
		font-family: var(--font-read);
		font-size: 16px;
		color: var(--bb-text);
	}

	.synopsis {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 14.5px;
		color: var(--bb-text-desc);
	}

	.into-note,
	.muted {
		font-size: 13.5px;
		color: var(--bb-text-3);
	}

	.into {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 16px;
		border-top: 1px solid var(--bb-line-soft);
	}

	.summary {
		font-size: 14px;
		color: var(--bb-text-2);
	}

	.footer-actions {
		display: flex;
		gap: 10px;
		margin-left: auto;
	}

	@media (max-width: 600px) {
		.import {
			padding: 18px 18px 20px;
		}
	}
</style>
