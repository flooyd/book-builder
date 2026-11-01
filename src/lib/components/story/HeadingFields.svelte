<script lang="ts">
	import { tick } from 'svelte';
	import { HEADING_LABEL_LENGTH, headingOf, type LabelStyle, type Noun } from '$lib/headings';

	// How a part or chapter opens in reading mode: its label (automatic, its own or none), whether
	// its title shows, and a preview of the result. The Edit details form holds the changes until
	// Save; the outline's details panel saves each one as it's made.
	type Changes = { headingLabel?: string | null; showTitle?: boolean };
	type Mode = 'automatic' | 'own' | 'hidden';

	let {
		noun,
		place,
		style,
		label,
		showTitle,
		titlesOff = false,
		title,
		subtitle = '',
		onchange
	}: {
		noun: Noun;
		/** The number an automatic label takes here; null for story-text parts, which have none. */
		place: number | null;
		/** The book's style for automatic labels. */
		style: LabelStyle;
		/** Saved label: null follows the book, '' hides it. */
		label: string | null;
		showTitle: boolean;
		/** The book has turned chapter titles off, so this one can't show either. */
		titlesOff?: boolean;
		title: string;
		/** The description as plain text, when it's set to show. */
		subtitle?: string;
		onchange: (changes: Changes) => void;
	} = $props();

	// Starts from the saved label: callers re-mount this for another part or chapter.
	// svelte-ignore state_referenced_locally
	let mode = $state<Mode>(label === null ? 'automatic' : label === '' ? 'hidden' : 'own');
	// svelte-ignore state_referenced_locally
	let text = $state(label ?? '');
	let input = $state<HTMLInputElement>();

	const uid = $props.id();
	const numbered = $derived(place !== null);
	const modes = $derived<{ id: Mode; name: string }[]>(
		numbered
			? [
					{ id: 'automatic', name: 'Automatic' },
					{ id: 'own', name: 'Your own' },
					{ id: 'hidden', name: 'Hidden' }
				]
			: [
					{ id: 'automatic', name: 'None' },
					{ id: 'own', name: 'Your own' }
				]
	);

	const own = $derived(mode === 'hidden' ? '' : mode === 'own' && text.trim() ? text.trim() : null);
	const preview = $derived(
		headingOf(own, noun, own === null ? place : null, style, showTitle && !titlesOff ? title : '')
	);

	async function choose(next: Mode) {
		mode = next;
		if (next === 'automatic') onchange({ headingLabel: null });
		else if (next === 'hidden') onchange({ headingLabel: '' });
		else if (text.trim()) onchange({ headingLabel: text.trim() });
		else {
			await tick();
			input?.focus();
		}
	}

	/** Leaving the box with nothing in it goes back to the automatic label. */
	function commit() {
		const value = text.trim();
		text = value;
		if (!value) mode = 'automatic';
		onchange({ headingLabel: value || null });
	}
</script>

<div class="heading-fields">
	<div class="label-row">
		<span id="{uid}-label" class="name">Label</span>
		<div class="modes" role="group" aria-labelledby="{uid}-label">
			{#each modes as option (option.id)}
				<button type="button" aria-pressed={mode === option.id} onclick={() => choose(option.id)}>
					{option.name}
				</button>
			{/each}
		</div>
	</div>

	{#if mode === 'own'}
		<input
			bind:this={input}
			bind:value={text}
			class="bb-field"
			autocomplete="off"
			maxlength={HEADING_LABEL_LENGTH}
			placeholder={noun === 'Part' ? 'Book One' : 'Interlude'}
			aria-label="Your own label"
			onchange={commit}
			onkeydown={(event) => {
				// In a form Enter saves it; in the details panel it just finishes the label.
				if (event.key === 'Enter' && !event.currentTarget.form) event.currentTarget.blur();
			}}
		/>
	{/if}
	{#if numbered && mode !== 'automatic'}
		<p class="hint">
			{noun}s with their own label, or none, aren't counted, so the numbers carry on without a gap.
		</p>
	{/if}

	<label class="check">
		<input
			type="checkbox"
			checked={showTitle && !titlesOff}
			disabled={titlesOff}
			onchange={(event) => onchange({ showTitle: event.currentTarget.checked })}
		/>
		Show the title
	</label>
	{#if titlesOff}
		<p class="hint">Chapter titles are off for this book, under Headings on the book's page.</p>
	{/if}

	<!-- A sample of the page, in the colours of a book; the fields above say all of it in words. -->
	<div class="preview" data-scheme="light" aria-hidden="true">
		{#if preview.over}<span class="over">{preview.over}</span>{/if}
		{#if preview.title}<span class="big">{preview.title}</span>{/if}
		{#if subtitle}<span class="sub">{subtitle}</span>{/if}
		{#if !preview.title && !subtitle}
			<span class="none">
				{numbered && noun === 'Part'
					? 'No title page. This part goes straight into its first chapter.'
					: 'No heading. The story text starts straight away.'}
			</span>
		{/if}
	</div>
</div>

<style>
	.heading-fields {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.label-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
	}

	.name {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.modes {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.modes button {
		min-height: 44px;
		padding: 0 14px;
		border-radius: var(--r-pill);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-panel);
		color: var(--bb-text);
		font: 600 14px var(--font-ui);
	}

	.modes button:hover {
		background: var(--bb-hover);
	}

	.modes button[aria-pressed='true'] {
		background: var(--bb-sky-wash);
		border-color: var(--bb-sky);
		color: var(--bb-sky-text);
	}

	.hint {
		font-size: 13.5px;
		line-height: 1.45;
		color: var(--bb-text-3);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font-size: 15px;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.check:has(:disabled) {
		color: var(--bb-text-3);
		cursor: default;
	}

	.check input {
		flex: none;
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 20px 16px;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-paper-line);
		background: var(--bb-paper);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.over {
		font: 700 11px var(--font-ui);
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.big {
		font-family: var(--font-display);
		font-size: 26px;
		line-height: 1.1;
		color: var(--bb-text-strong);
	}

	.sub {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 16px;
		color: var(--bb-text-desc);
	}

	.none {
		font-size: 13.5px;
		color: var(--bb-paper-muted);
	}
</style>
