<script lang="ts">
	import { capOf, capPresentation, toHTML, type RichKind } from '$lib/rich';

	// Shows a stored value: story text as typeset blocks (with its first letter), a description as
	// inline text. toHTML only emits allow-listed markup, so {@html} is safe here.
	let {
		value,
		kind = 'description',
		italic = false,
		class: className = ''
	}: {
		value: string;
		kind?: RichKind;
		/** The text around is italic: emphasis inside it turns roman. */
		italic?: boolean;
		class?: string;
	} = $props();

	const html = $derived(toHTML(value, kind));
	const cap = $derived(kind === 'story' ? capPresentation(capOf(value)) : null);
</script>

{#if cap}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- toHTML escapes text and allow-lists markup -->
	<div class={['bb-prose', cap.class, className]} style={cap.style}>{@html html}</div>
{:else}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- toHTML escapes text and allow-lists markup -->
	<span class={['rich-text', { 'rich-italic': italic }, className]}>{@html html}</span>
{/if}
