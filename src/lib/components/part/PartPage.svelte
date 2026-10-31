<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		booksStore,
		chaptersStore,
		modalStore,
		partsStore,
		userStore,
		type Chapter,
		type Part
	} from '$lib/stores';
	import { bookOutline, latestChapterId, plural, putJSON } from '$lib/library';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { StoryTextDoc, guardStoryText } from '$lib/story-text.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Pill from '$lib/components/ui/Pill.svelte';
	import TocChapterRow from '$lib/components/book/TocChapterRow.svelte';
	import PageFrame from '$lib/components/story/PageFrame.svelte';
	import Rail from '$lib/components/story/Rail.svelte';
	import TitleBlock from '$lib/components/story/TitleBlock.svelte';
	import StorySurface from '$lib/components/story/StorySurface.svelte';
	import SaveStatus from '$lib/components/story/SaveStatus.svelte';
	import Missing from '$lib/components/story/Missing.svelte';

	let { id }: { id: number } = $props();

	const part = $derived($partsStore.find((p) => p.id === id));
	const book = $derived(part && $booksStore.find((b) => b.id === part.bookId));
	const outline = $derived(book ? bookOutline(book.id, $partsStore, $chaptersStore) : []);
	const entry = $derived(outline.find((e) => e.part.id === id));
	const latestId = $derived(latestChapterId(outline));
	const isOwner = $derived(!!part && $userStore?.id === part.userId);
	const holdsText = $derived(!!part && !part.hasChapters);

	const partHref = (p: Part) => resolve('/part/[id]', { id: String(p.id) });
	const chapterHref = (c: Chapter) => resolve('/chapter/[id]', { id: String(c.id) });

	const railItems = $derived(
		outline.map((item) => ({
			key: item.part.id,
			href: partHref(item.part),
			name: item.part.title,
			current: item.part.id === id,
			count: item.label ? item.chapters.length : undefined,
			countLabel: plural(item.chapters.length, 'chapter')
		}))
	);

	// Header: breadcrumb, plus save state and Save for story-text parts.
	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(book
				? [{ label: book.title, href: resolve('/book/[id]', { id: String(book.id) }) }]
				: []),
			...(part ? [{ label: part.title }] : [])
		];
		header.actions = holdsText ? saveActions : null;
	});

	// One document per mounted page: the route re-mounts this component when `id` changes.
	// svelte-ignore state_referenced_locally
	const doc = new StoryTextDoc('part', id);
	guardStoryText(doc, () => holdsText);

	$effect(() => {
		if (holdsText) doc.load();
	});

	async function saveDetails(title: string, description: string, showDescription: boolean) {
		const updated = await putJSON<Part>(`/api/part/${id}`, { title, description, showDescription });
		partsStore.update((parts) => parts.map((p) => (p.id === updated.id ? updated : p)));
	}

	const newPart = () => modalStore.set({ type: 'create', category: 'part', bookId: part?.bookId });
	const newChapter = () =>
		modalStore.set({ type: 'create', category: 'chapter', bookId: part?.bookId, partId: id });
</script>

<svelte:head>
	<title
		>{part && book ? `${part.title} · ${book.title} · Book Builder` : 'Part · Book Builder'}</title
	>
</svelte:head>

{#snippet saveActions()}
	<SaveStatus {doc} />
{/snippet}

{#snippet rail()}
	<Rail label="In this book" items={railItems} newLabel="New part" onnew={newPart} />
{/snippet}

{#if part && book && entry}
	<PageFrame {rail}>
		<TitleBlock
			title={part.title}
			description={part.description}
			showDescription={part.showDescription}
			descriptionPlaceholder="A line about this part"
			readHref="{resolve('/book/[id]/read', { id: String(book.id) })}#part-{part.id}"
			canEdit={isOwner}
			onsave={saveDetails}
		>
			{#snippet overline()}
				{entry.label ?? 'Part'} ·
				<a href={resolve('/book/[id]', { id: String(book.id) })}>{book.title}</a>
			{/snippet}
			{#if holdsText}
				<span class="holds-text">
					<Pill icon="info">No chapters — this part holds its own story text</Pill>
				</span>
			{/if}
		</TitleBlock>

		{#if holdsText}
			<StorySurface {doc} title={part.title} />
		{:else}
			<section aria-labelledby="h-chapters" class="chapters">
				<h2 id="h-chapters">Chapters</h2>
				{#each entry.chapters as { chapter, number } (chapter.id)}
					<TocChapterRow
						href={chapterHref(chapter)}
						{number}
						title={chapter.title}
						updatedAt={chapter.updatedAt}
						latest={chapter.id === latestId}
						compact
					/>
				{:else}
					<p class="empty">No chapters yet.</p>
				{/each}
				<button type="button" class="add" onclick={newChapter}>
					<Icon name="plus" size={16} strokeWidth={2.2} />Add a chapter
				</button>
			</section>
		{/if}
	</PageFrame>
{:else}
	<Missing noun="part" />
{/if}

<style>
	.holds-text {
		margin-top: 6px;
		align-self: flex-start;
	}

	.chapters {
		max-width: 760px;
		margin: 36px auto 0;
	}

	.chapters h2 {
		margin: 0 0 14px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 28px;
		color: var(--bb-text-strong);
	}

	.empty {
		color: var(--bb-text-3);
	}

	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		width: 100%;
		min-height: 52px;
		margin-top: 22px;
		border-radius: var(--r-row);
		border: 1.5px dashed var(--bb-line-control);
		background: transparent;
		color: var(--bb-text-2);
		font: 600 15px var(--font-ui);
	}

	.add:hover {
		border-color: var(--bb-sky);
		color: var(--bb-text);
	}
</style>
