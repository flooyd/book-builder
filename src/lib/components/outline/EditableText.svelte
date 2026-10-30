<script lang="ts">
	// A title or synopsis edited in place: looks like text until focused, saves a moment after
	// typing stops and when focus leaves. A required field that is left empty goes back to its
	// saved value.
	let {
		id,
		value,
		label,
		placeholder = '',
		multiline = false,
		required = false,
		class: className = '',
		onsave,
		onkeydown,
		onfocus
	}: {
		id?: string;
		value: string;
		/** Accessible name. */
		label: string;
		placeholder?: string;
		multiline?: boolean;
		required?: boolean;
		class?: string;
		onsave: (value: string) => Promise<unknown>;
		onkeydown?: (event: KeyboardEvent) => void;
		onfocus?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let draft = $state(value);
	let focused = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let field = $state<HTMLInputElement | HTMLTextAreaElement>();

	// Follow saves and changes from elsewhere, except while being edited.
	$effect(() => {
		const next = value;
		if (!focused) draft = next;
	});

	// Textareas grow with their text: field-sizing where supported, measured otherwise (not while
	// hidden, e.g. in a dialog that hasn't opened yet: that would measure 0).
	function fit() {
		if (!multiline || !field || CSS.supports('field-sizing', 'content')) return;
		field.style.height = 'auto';
		if (field.scrollHeight > 0) field.style.height = `${field.scrollHeight}px`;
	}

	$effect(() => {
		void draft;
		fit();
	});

	async function save() {
		clearTimeout(timer);
		const next = draft.trim();
		if (required && !next) return;
		if (next === value.trim()) return;
		await onsave(next);
	}

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(save, 800);
	}

	function onblur() {
		focused = false;
		if (required && !draft.trim()) {
			clearTimeout(timer);
			draft = value;
			return;
		}
		save();
	}

	function focus() {
		focused = true;
		fit();
		onfocus?.();
	}
</script>

{#if multiline}
	<textarea
		bind:this={field}
		bind:value={draft}
		{id}
		class={['editable', className]}
		rows="1"
		aria-label={label}
		{placeholder}
		{oninput}
		{onblur}
		onfocus={focus}
		{onkeydown}></textarea>
{:else}
	<input
		bind:this={field}
		bind:value={draft}
		{id}
		class={['editable', className]}
		type="text"
		autocomplete="off"
		aria-label={label}
		{placeholder}
		{oninput}
		{onblur}
		onfocus={focus}
		{onkeydown}
	/>
{/if}

<style>
	.editable {
		display: block;
		width: 100%;
		min-width: 0;
		margin: 0;
		padding: 2px 6px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
		resize: none;
		overflow: hidden;
		field-sizing: content;
	}

	.editable:hover {
		border-color: var(--bb-line-soft);
	}

	.editable:focus-visible,
	.editable:focus {
		outline: none;
		border-color: var(--bb-sky);
		background: var(--bb-ink);
		box-shadow: var(--focus-ring);
	}

	.editable::placeholder {
		color: var(--bb-text-4);
		font-style: italic;
	}
</style>
