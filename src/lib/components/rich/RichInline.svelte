<script lang="ts">
	import RichEditor from './RichEditor.svelte';
	import RichText from './RichText.svelte';

	// A description shown as formatted text and edited in place: click it (or Enter) and the
	// editor opens with its toolbar; it saves as you type and closes when focus leaves.
	let {
		value,
		label,
		placeholder = '',
		class: className = '',
		onsave,
		onfocus
	}: {
		value: string;
		/** What it is, for screen readers ("Synopsis of …"). */
		label: string;
		placeholder?: string;
		class?: string;
		onsave: (value: string) => unknown;
		onfocus?: () => void;
	} = $props();

	let editing = $state(false);
	let wrapper = $state<HTMLElement>();
	// Focus has reached the editor since it opened. Swapping the text for the editor drops focus
	// from the text, which mustn't count as leaving.
	let inside = false;

	function open() {
		editing = true;
		inside = false;
		onfocus?.();
	}

	// Leaving the field closes it; moving into its own toolbar or colour menus doesn't.
	function onfocusout(event: FocusEvent) {
		if (!editing || !inside) return;
		if (wrapper?.contains(event.relatedTarget as Node | null)) return;
		editing = false;
	}

	function onfocusin() {
		if (editing) inside = true;
	}
</script>

<div class={['rich-inline', className, { editing }]} bind:this={wrapper} {onfocusin} {onfocusout}>
	{#if editing}
		<RichEditor
			kind="description"
			{value}
			{label}
			{placeholder}
			autofocus
			delay={800}
			onchange={(next) => onsave(next)}
			onescape={() => (editing = false)}
		/>
	{:else}
		<div
			class="shown"
			role="button"
			tabindex="0"
			onclick={open}
			onkeydown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					open();
				}
			}}
		>
			<span class="sr-only">Edit {label}:</span>
			{#if value}
				<RichText {value} italic />
			{:else}
				<span class="placeholder">{placeholder}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.rich-inline {
		min-width: 0;
	}

	.shown,
	.rich-inline :global(.rich-area) {
		padding: 2px 6px;
		border: 1px solid transparent;
		border-radius: 8px;
		cursor: text;
	}

	.shown:hover {
		border-color: var(--bb-line-soft);
	}

	.shown:focus-visible {
		outline: none;
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.editing :global(.rich-area) {
		border-color: var(--bb-sky);
		background: var(--bb-ink);
		box-shadow: var(--focus-ring);
	}

	.editing :global(.bar) {
		margin-bottom: 6px;
		font-style: normal;
	}

	.placeholder {
		color: var(--bb-text-4);
	}
</style>
