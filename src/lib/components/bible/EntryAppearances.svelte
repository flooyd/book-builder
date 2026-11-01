<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Appearance, EntryType } from '$lib/bible';
	import { bookOutline, plural } from '$lib/library';
	import { booksStore, chaptersStore, partsStore } from '$lib/stores';

	// Where an entry appears, book by book in reading order: by being mentioned, by being in the
	// cast, or both.
	let { type, appearances }: { type: EntryType; appearances: Appearance[] } = $props();

	const uid = $props.id();

	const at = (target: 'part' | 'chapter', id: number) =>
		appearances.find((item) => item.target === target && item.id === id);

	const books = $derived(
		$booksStore.flatMap((book) => {
			const rows = bookOutline(book.id, $partsStore, $chaptersStore).flatMap((item) => {
				if (!item.label) {
					const found = at('part', item.part.id);
					if (!found) return [];
					return [
						{
							key: `part-${item.part.id}`,
							href: resolve('/part/[id]', { id: String(item.part.id) }),
							number: '',
							title: item.part.title,
							found
						}
					];
				}
				return item.chapters.flatMap(({ chapter, number }) => {
					const found = at('chapter', chapter.id);
					if (!found) return [];
					return [
						{
							key: `chapter-${chapter.id}`,
							href: resolve('/chapter/[id]', { id: String(chapter.id) }),
							number: String(number ?? ''),
							title: chapter.title,
							found
						}
					];
				});
			});
			return rows.length > 0 ? [{ book, rows }] : [];
		})
	);

	const summary = (found: Appearance) =>
		[found.uses > 0 ? plural(found.uses, 'mention') : '', found.cast ? 'In the cast' : '']
			.filter(Boolean)
			.join(' · ');
</script>

<section class="panel" aria-labelledby="{uid}-title">
	<h2 id="{uid}-title">Appears in</h2>
	{#each books as { book, rows } (book.id)}
		<div class="book">
			{#if books.length > 1}
				<h3>{book.title}</h3>
			{/if}
			<ul>
				{#each rows as row (row.key)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- row.href is resolve()d -->
						<a href={row.href}>
							<span class="number" aria-hidden={!row.number}>{row.number}</span>
							<span class="text">
								<span class="title">{row.title}</span>
								<span class="meta">{summary(row.found)}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<p class="empty">
			Not in a chapter yet. Type @ in your story text, or add {type === 'character' ? 'them' : 'it'}
			to a chapter in the outline.
		</p>
	{/each}
</section>

<style>
	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	h3 {
		margin-bottom: 4px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
		padding: 6px 8px;
		margin: 0 -8px;
		border-radius: 10px;
		color: inherit;
		text-decoration: none;
	}

	a:hover {
		background: var(--bb-hover);
	}

	.number {
		flex: none;
		width: 22px;
		font-family: var(--font-display);
		font-size: 17px;
		color: var(--bb-sky);
		text-align: right;
	}

	.text {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.title {
		font-weight: 600;
		font-size: 15px;
		overflow-wrap: anywhere;
	}

	.meta {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.empty {
		font-size: 14.5px;
		line-height: 1.45;
		color: var(--bb-text-3);
	}
</style>
