<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichEditor from '$lib/components/rich/RichEditor.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';

	// Overline, title, italic description and inline "Edit details" for part and chapter pages.
	let {
		overline,
		title,
		description,
		showDescription,
		descriptionPlaceholder,
		readHref,
		canEdit,
		onsave,
		children
	}: {
		overline: Snippet;
		title: string;
		description: string;
		/** Whether reading mode shows the description as a subtitle under the title. */
		showDescription: boolean;
		descriptionPlaceholder: string;
		/** Opens this part or chapter in reading mode. */
		readHref: string;
		canEdit: boolean;
		/** Persist the edit; throw an Error with a message to show it inline. */
		onsave: (title: string, description: string, showDescription: boolean) => Promise<void>;
		children?: Snippet;
	} = $props();

	let editing = $state(false);
	let draftTitle = $state('');
	let draftDescription = $state('');
	let draftShow = $state(false);
	let descriptionEditor = $state<RichEditor>();
	let saving = $state(false);
	let error = $state('');
	let titleInput = $state<HTMLInputElement>();

	async function startEdit() {
		draftTitle = title;
		draftDescription = description;
		draftShow = showDescription;
		error = '';
		editing = true;
		await tick();
		titleInput?.focus();
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		descriptionEditor?.flush();
		if (!draftTitle.trim()) {
			error = 'Give it a title.';
			titleInput?.focus();
			return;
		}
		saving = true;
		error = '';
		try {
			await onsave(draftTitle, draftDescription, draftShow);
			editing = false;
		} catch (err) {
			error = err instanceof Error ? err.message : "Couldn't save.";
		} finally {
			saving = false;
		}
	}

	const cancelOnEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape') editing = false;
	};
</script>

<div class="title-block">
	<span class="overline">{@render overline()}</span>

	{#if editing}
		<form class="edit" onsubmit={submit}>
			<label class="sr-only" for="details-title">Title</label>
			<input
				bind:this={titleInput}
				bind:value={draftTitle}
				id="details-title"
				class="edit-title"
				autocomplete="off"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? 'details-error' : undefined}
				onkeydown={cancelOnEscape}
			/>
			<RichEditor
				bind:this={descriptionEditor}
				kind="description"
				class="edit-description"
				boxed
				italic
				value={draftDescription}
				onchange={(value) => (draftDescription = value)}
				label="Description"
				placeholder={descriptionPlaceholder}
				onescape={() => (editing = false)}
			/>
			<label class="show">
				<input type="checkbox" bind:checked={draftShow} />
				Show the description under the title in reading mode
			</label>
			{#if error}
				<p id="details-error" class="error" role="alert">
					<Icon name="alert-circle" size={16} />{error}
				</p>
			{/if}
			<div class="edit-actions">
				<Button type="submit" variant="primary" disabled={saving}>
					<Icon name="check" size={16} />{saving ? 'Saving…' : 'Save details'}
				</Button>
				<Button variant="quiet" onclick={() => (editing = false)} disabled={saving}>Cancel</Button>
			</div>
		</form>
	{:else}
		<div class="title-row">
			<!-- Re-created when the title changes: the headline splits its text once. -->
			{#key title}
				<h1><motion-headline by="words" interval={0.07}>{title}</motion-headline></h1>
			{/key}
			<div class="title-actions">
				<Button href={readHref}><Icon name="book-open" size={15} />Read</Button>
				{#if canEdit}
					<Button onclick={startEdit}><Icon name="pen" size={15} />Edit details</Button>
				{/if}
			</div>
		</div>
		{#if description}
			<p class="description"><RichText value={description} italic /></p>
			{#if showDescription}
				<p class="shown"><Icon name="book-open" size={14} />Shown as a subtitle in reading mode</p>
			{/if}
		{/if}
	{/if}

	{@render children?.()}
</div>

<style>
	.title-block {
		max-width: 760px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
		overflow-wrap: anywhere;
	}

	.overline :global(a) {
		color: inherit;
		text-decoration: none;
	}

	.overline :global(a:hover) {
		color: var(--bb-sky-hover);
		text-decoration: underline;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
	}

	.title-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	h1 {
		min-width: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(48px, 5vw, 76px);
		line-height: 0.98;
		letter-spacing: -0.015em;
		color: var(--bb-text-strong);
		overflow-wrap: break-word;
	}

	.description {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 22px;
		color: var(--bb-text-desc);
	}

	.edit {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.edit-title {
		width: 100%;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-night);
		color: var(--bb-text-strong);
	}

	.edit-title {
		padding: 6px 14px;
		font-family: var(--font-display);
		font-size: clamp(36px, 4vw, 56px);
		line-height: 1.1;
	}

	.edit :global(.edit-description) {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 20px;
		line-height: 1.45;
		color: var(--bb-text-desc);
	}

	.edit-title:focus-visible {
		outline: none;
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.edit-title[aria-invalid='true'] {
		border-color: var(--bb-coral);
	}

	.shown {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: -4px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.show {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font-size: 15px;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.show input {
		flex: none;
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	.edit-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	@media (max-width: 760px) {
		h1 {
			font-size: 42px;
		}
	}
</style>
