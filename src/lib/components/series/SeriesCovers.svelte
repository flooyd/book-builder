<script lang="ts">
	import { coverFrom, type CoverArt } from '$lib/art';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import { artStore } from '$lib/stores';

	// A series on the shelf: its first three covers fanned out, or a dashed gap while it's empty.
	// Decorative, as the title beside it says what it is.
	let {
		books,
		author = '',
		size = 'md'
	}: {
		/** A public page sends each book's `cover`; the owner's pages find it on their own shelf. */
		books: { id: number; title: string; cover?: CoverArt | null; coverArtId?: number | null }[];
		author?: string;
		size?: 'md' | 'lg';
	} = $props();

	const shown = $derived(books.slice(0, 3));
</script>

<span class={['fan', size]} style:--count={Math.max(shown.length, 1)} aria-hidden="true">
	{#each shown as book, index (book.id)}
		<span class="leaf" style:--index={index}>
			<BookCover
				id={book.id}
				title={book.title}
				{author}
				{size}
				art={book.cover !== undefined ? book.cover : coverFrom($artStore, book.coverArtId ?? null)}
			/>
		</span>
	{:else}
		<span class="leaf gap"></span>
	{/each}
</span>

<style>
	.fan {
		--step: 24px;
		--width: 128px;
		--height: 172px;
		position: relative;
		flex: none;
		align-self: flex-start;
		display: block;
		width: calc(var(--width) + (var(--count) - 1) * var(--step));
		height: var(--height);
	}

	.fan.lg {
		--step: 40px;
		--width: 196px;
		--height: 264px;
	}

	/* The first book lies on top, the later ones lean out from behind it. */
	.leaf {
		position: absolute;
		top: 0;
		left: calc(var(--index) * var(--step));
		z-index: calc(3 - var(--index));
		transform: rotate(calc(var(--index) * 2.5deg));
		transform-origin: 50% 100%;
	}

	/* Only an edge of these shows, and half a word on it would read as a mistake. */
	.leaf + .leaf :global(.title),
	.leaf + .leaf :global(.over),
	.leaf + .leaf :global(.emblem),
	.leaf + .leaf :global(svg) {
		visibility: hidden;
	}

	.gap {
		width: var(--width);
		height: var(--height);
		border: 1.5px dashed var(--bb-line-dashed);
		border-radius: 3px 8px 8px 3px;
	}

	/* A phone's card can't spare the width. */
	@media (max-width: 600px) {
		.fan {
			--step: 12px;
		}

		.fan.lg {
			--step: 30px;
		}
	}
</style>
