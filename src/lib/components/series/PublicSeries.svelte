<script lang="ts">
	import type { CoverArt } from '$lib/art';
	import { resolve } from '$app/paths';
	import { plural } from '$lib/library';
	import { plainText } from '$lib/rich';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';
	import SeriesCovers from './SeriesCovers.svelte';

	// A series on an author's public page: the books they've shared, in reading order. A book they
	// haven't shared isn't mentioned, but the rest keep their numbers.
	let {
		series,
		handle
	}: {
		series: {
			title: string;
			description: string;
			author: string;
			books: {
				id: number;
				title: string;
				description: string;
				shareId: string;
				number: number;
				cover: CoverArt | null;
			}[];
		};
		handle: string;
	} = $props();
</script>

<svelte:head>
	<title>{series.title} · {series.author} · Book Builder</title>
	<meta
		name="description"
		content={plainText(series.description, 'description') ||
			`A series by ${series.author} on Book Builder.`}
	/>
</svelte:head>

<main class="series">
	<header class="hero">
		<SeriesCovers books={series.books} author={series.author} size="lg" />
		<p class="overline">
			A series by <a href={resolve('/author/[handle]', { handle })}>{series.author}</a>
		</p>
		<h1><motion-headline by="words" interval={0.08}>{series.title}</motion-headline></h1>
		{#if series.description}
			<p class="blurb"><RichText value={series.description} italic /></p>
		{/if}
	</header>

	<section class="shelf" aria-labelledby="h-order">
		<h2 id="h-order">
			Reading order <span class="count">{plural(series.books.length, 'book')}</span>
		</h2>
		<div class="books">
			<motion-stagger interval={0.08}>
				{#each series.books as book (book.id)}
					<a class="book" href={resolve('/read/[shareId]', { shareId: book.shareId })}>
						<BookCover
							id={book.id}
							title={book.title}
							author={series.author}
							tilt
							art={book.cover}
						/>
						<span class="book-text">
							<span class="number">Book {book.number}</span>
							<span class="book-title">{book.title}</span>
							{#if book.description}
								<span class="book-desc"><RichText value={book.description} italic /></span>
							{/if}
							<span class="read">Read <Icon name="arrow-right" size={15} /></span>
						</span>
					</a>
				{/each}
			</motion-stagger>
		</div>
	</section>
</main>

<style>
	.series {
		max-width: 1080px;
		margin: 0 auto;
		padding: 56px 32px 96px;
	}

	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		text-align: center;
	}

	.hero :global(.fan) {
		align-self: center;
		margin-bottom: 20px;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.overline a {
		color: inherit;
		text-underline-offset: 4px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(44px, 6vw, 72px);
		line-height: 1;
		/* The tails of J, g and y hang below a line this tight, so leave them room above the blurb. */
		margin-bottom: 0.2em;
		color: var(--bb-text-strong);
		text-wrap: balance;
	}

	.blurb {
		max-width: 34em;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 21px;
		line-height: 1.5;
		color: var(--bb-text-desc);
		text-wrap: balance;
	}

	.shelf {
		margin-top: 64px;
	}

	h2 {
		display: flex;
		align-items: baseline;
		gap: 14px;
		margin-bottom: 22px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--bb-line-faint);
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		color: var(--bb-text-strong);
	}

	.count {
		font-family: var(--font-ui);
		font-size: 14px;
		color: var(--bb-text-3);
	}

	.books {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(440px, 100%), 1fr));
		gap: 18px;
	}

	.book {
		display: flex;
		gap: 22px;
		padding: 20px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		text-decoration: none;
		color: var(--bb-text);
		transition: border-color 0.15s;
	}

	.book:hover {
		border-color: var(--bb-line-dashed);
		color: var(--bb-text);
	}

	.book-text {
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-width: 0;
		padding-top: 4px;
	}

	.number {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.book-title {
		font-family: var(--font-display);
		font-size: 28px;
		line-height: 1.05;
		overflow-wrap: break-word;
	}

	.book-desc {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 17px;
		line-height: 1.45;
		color: var(--bb-text-2);
	}

	.read {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: auto;
		font-size: 14.5px;
		font-weight: 700;
		color: var(--bb-sky);
	}

	@media (max-width: 600px) {
		.series {
			padding: 32px 4px 72px;
		}

		.book {
			gap: 16px;
			padding: 16px;
		}

		.book-title {
			font-size: 24px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.book {
			transition: none;
		}
	}
</style>
