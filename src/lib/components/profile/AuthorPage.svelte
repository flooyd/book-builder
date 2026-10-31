<script lang="ts">
	import { resolve } from '$app/paths';
	import { initials, plural } from '$lib/library';
	import { plainText } from '$lib/rich';
	import { websiteLabel } from '$lib/profile';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';

	// An author's public page: who they are, and the books they share by link.
	let {
		author
	}: {
		author: {
			name: string;
			bio: string;
			website: string;
			books: { id: number; title: string; description: string; shareId: string }[];
		};
	} = $props();
</script>

<svelte:head>
	<title>{author.name} · Book Builder</title>
	<meta
		name="description"
		content={plainText(author.bio, 'description') || `Books by ${author.name} on Book Builder.`}
	/>
</svelte:head>

<main class="author">
	<header class="hero">
		<span class="monogram" aria-hidden="true">{initials(author.name)}</span>
		<p class="overline">Author</p>
		<h1><motion-headline by="words" interval={0.08}>{author.name}</motion-headline></h1>
		{#if author.bio}
			<p class="bio"><RichText value={author.bio} italic /></p>
		{/if}
		{#if author.website}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an external http(s) URL, checked when saved -->
			<a class="website" href={author.website} target="_blank" rel="noopener nofollow ugc">
				<Icon name="globe" size={15} />{websiteLabel(author.website)}
			</a>
		{/if}
	</header>

	<section class="shelf" aria-labelledby="h-books">
		<h2 id="h-books">
			Books <span class="count">{plural(author.books.length, 'book')}</span>
		</h2>
		{#if author.books.length > 0}
			<div class="books">
				<motion-stagger interval={0.08}>
					{#each author.books as book (book.id)}
						<a class="book" href={resolve('/read/[shareId]', { shareId: book.shareId })}>
							<BookCover id={book.id} title={book.title} author={author.name} tilt />
							<span class="book-text">
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
		{:else}
			<p class="empty">No books shared yet.</p>
		{/if}
	</section>
</main>

<style>
	.author {
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

	.monogram {
		display: grid;
		place-items: center;
		width: 96px;
		height: 96px;
		margin-bottom: 8px;
		border-radius: 50%;
		background: light-dark(#141c45, var(--bb-paper));
		color: light-dark(var(--bb-paper), #141c45);
		font-family: var(--font-display);
		font-size: 38px;
		box-shadow:
			0 0 0 4px var(--bb-night),
			0 0 0 5px var(--bb-sky);
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(44px, 6vw, 72px);
		line-height: 1;
		color: var(--bb-text-strong);
		text-wrap: balance;
	}

	.bio {
		max-width: 34em;
		font-family: var(--font-read);
		font-style: italic;
		font-size: 21px;
		line-height: 1.5;
		color: var(--bb-text-desc);
		text-wrap: balance;
	}

	.website {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		font-size: 15px;
		font-weight: 600;
		text-decoration: none;
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

	.empty {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 18px;
		color: var(--bb-text-3);
	}

	@media (max-width: 600px) {
		.author {
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
</style>
