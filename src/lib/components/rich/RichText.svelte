<script lang="ts">
	import { capOf, capPresentation, toHTML, type PictureSources, type RichKind } from '$lib/rich';

	// Shows a stored value: story text as typeset blocks (with its first letter), a description as
	// inline text. toHTML only emits allow-listed markup, so {@html} is safe here.
	let {
		value,
		kind = 'description',
		italic = false,
		notes,
		pictures,
		class: className = ''
	}: {
		value: string;
		kind?: RichKind;
		/** The text around is italic: emphasis inside it turns roman. */
		italic?: boolean;
		/**
		 * Story text: an id for its footnotes that nothing else on the page has (the section's key),
		 * so each number links to its note and back. Left out, the numbers are only numbers.
		 */
		notes?: string;
		/** Story text: where its pictures are. One that isn't here isn't shown. */
		pictures?: PictureSources;
		class?: string;
	} = $props();

	const html = $derived(toHTML(value, kind, notes, pictures));
	const cap = $derived(kind === 'story' ? capPresentation(capOf(value)) : null);
</script>

{#if cap}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- toHTML escapes text and allow-lists markup -->
	<div class={['bb-prose', cap.class, className]} style={cap.style}>{@html html}</div>
{:else}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- toHTML escapes text and allow-lists markup -->
	<span class={['rich-text', { 'rich-italic': italic }, className]}>{@html html}</span>
{/if}
