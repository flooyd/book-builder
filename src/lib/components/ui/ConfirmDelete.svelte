<script lang="ts">
	import type { Snippet } from 'svelte';
	import { confirmWord, typedTitle } from '$lib/confirm';
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';
	import Icon from './Icon.svelte';

	// Asks before a book, part or chapter is deleted for good, and won't go ahead until its title
	// has been typed. Nothing can bring one back, so a slip of the finger mustn't be enough.
	let {
		noun,
		title,
		busy = false,
		error = '',
		onconfirm,
		onclose,
		children
	}: {
		/** What's going, as the button and the label say it: "book", "part", "chapter". */
		noun: string;
		/** Its title, which has to be typed. */
		title: string;
		/** The delete is under way. */
		busy?: boolean;
		/** Why the last try failed. */
		error?: string;
		onconfirm: () => void;
		onclose: () => void;
		/** What goes with it. */
		children: Snippet;
	} = $props();

	const uid = $props.id();
	let typed = $state('');
	const word = $derived(confirmWord(title));
	const ready = $derived(typedTitle(typed, title));
	const untitled = $derived(word !== title.trim());

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (ready && !busy) onconfirm();
	}
</script>

<Dialog labelledby="{uid}-title" width={460} {onclose}>
	<form class="confirm" onsubmit={submit} novalidate>
		<h2 id="{uid}-title">
			{#if untitled}Delete this {noun}?{:else}Delete <em>{title}</em>?{/if}
		</h2>
		{@render children()}

		<div class="field">
			<label for="{uid}-typed">
				{#if untitled}
					Type <strong>delete</strong> to confirm
				{:else}
					Type the {noun}’s title to confirm
				{/if}
			</label>
			<!-- No autocorrect: it would "fix" invented names into real words. -->
			<input
				bind:value={typed}
				id="{uid}-typed"
				class="bb-field"
				type="text"
				autocomplete="off"
				autocorrect="off"
				spellcheck="false"
				disabled={busy}
			/>
		</div>

		{#if error}
			<p class="error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
		{/if}

		<div class="confirm-actions">
			<Button variant="quiet" onclick={onclose} disabled={busy}>Cancel</Button>
			<Button type="submit" variant="danger" disabled={!ready || busy}>
				<Icon name="trash" size={16} />{busy ? 'Deleting…' : `Delete ${noun}`}
			</Button>
		</div>
	</form>
</Dialog>

<style>
	.confirm {
		padding: 28px 30px 26px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		line-height: 1.1;
		color: var(--bb-text-strong);
		overflow-wrap: break-word;
	}

	em {
		font-family: var(--font-read);
		font-style: italic;
	}

	.confirm :global(p) {
		font-size: 15.5px;
		line-height: 1.5;
		color: var(--bb-text-2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 8px;
	}

	label {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
		overflow-wrap: anywhere;
	}

	label strong {
		color: var(--bb-text-strong);
	}

	.bb-field {
		background: var(--bb-night);
	}

	/* Above the paragraphs' rule, which would otherwise colour it like the rest. */
	.confirm .error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 14px;
		padding-top: 20px;
		border-top: 1px solid var(--bb-line-soft);
	}

	@media (max-width: 600px) {
		.confirm {
			padding: 24px 20px 20px;
		}

		h2 {
			font-size: 26px;
		}
	}
</style>
