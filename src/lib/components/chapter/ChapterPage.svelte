<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		booksStore,
		chaptersStore,
		modalStore,
		partsStore,
		userStore,
		type Chapter
	} from '$lib/stores';
	import { bookOutline, putJSON } from '$lib/library';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { StoryTextDoc, guardStoryText } from '$lib/story-text.svelte';
	import PageFrame from '$lib/components/story/PageFrame.svelte';
	import Rail from '$lib/components/story/Rail.svelte';
	import TitleBlock from '$lib/components/story/TitleBlock.svelte';
	import StorySurface from '$lib/components/story/StorySurface.svelte';
	import SaveStatus from '$lib/components/story/SaveStatus.svelte';
	import Missing from '$lib/components/story/Missing.svelte';

	let { id }: { id: number } = $props();

	const chapter = $derived($chaptersStore.find((c) => c.id === id));
	const part = $derived(chapter && $partsStore.find((p) => p.id === chapter.partId));
	const book = $derived(part && $booksStore.find((b) => b.id === part.bookId));
	const entry = $derived(
		book && part
			? bookOutline(book.id, $partsStore, $chaptersStore).find((e) => e.part.id === part.id)
			: undefined
	);
	const number = $derived(entry?.chapters.find((c) => c.chapter.id === id)?.number);
	const isOwner = $derived(!!part && $userStore?.id === part.userId);

	const chapterHref = (c: Chapter) => resolve('/chapter/[id]', { id: String(c.id) });

	const railItems = $derived(
		(entry?.chapters ?? []).map((item) => ({
			key: item.chapter.id,
			href: chapterHref(item.chapter),
			name: item.chapter.title,
			number: item.number,
			current: item.chapter.id === id
		}))
	);

	useAppHeader((header) => {
		header.wide = true;
		header.crumbs = [
			{ label: 'Library', href: resolve('/') },
			...(book
				? [{ label: book.title, href: resolve('/book/[id]', { id: String(book.id) }) }]
				: []),
			...(part
				? [{ label: part.title, href: resolve('/part/[id]', { id: String(part.id) }) }]
				: []),
			...(chapter ? [{ label: chapter.title }] : [])
		];
		header.actions = chapter ? saveActions : null;
	});

	// One document per mounted page: the route re-mounts this component when `id` changes.
	// svelte-ignore state_referenced_locally
	const doc = new StoryTextDoc('chapter', id);
	guardStoryText(doc);

	$effect(() => {
		if (chapter) doc.load();
	});

	async function saveDetails(title: string, description: string, showDescription: boolean) {
		const updated = await putJSON<Chapter>(`/api/chapter/${id}`, {
			title,
			description,
			showDescription
		});
		chaptersStore.update((chapters) => chapters.map((c) => (c.id === updated.id ? updated : c)));
	}

	const newChapter = () =>
		modalStore.set({ type: 'create', category: 'chapter', bookId: book?.id, partId: part?.id });
</script>

<svelte:head>
	<title
		>{chapter && book
			? `${chapter.title} · ${book.title} · Book Builder`
			: 'Chapter · Book Builder'}</title
	>
</svelte:head>

{#snippet saveActions()}
	<SaveStatus {doc} />
{/snippet}

{#snippet rail()}
	<Rail label="In this part" items={railItems} newLabel="New chapter" onnew={newChapter} />
{/snippet}

{#if chapter && part && book}
	<PageFrame {rail}>
		<TitleBlock
			title={chapter.title}
			description={chapter.description}
			showDescription={chapter.showDescription}
			descriptionPlaceholder="What happens here?"
			readHref="{resolve('/book/[id]/read', { id: String(book.id) })}#chapter-{chapter.id}"
			canEdit={isOwner}
			onsave={saveDetails}
		>
			{#snippet overline()}
				Chapter {number ?? ''} ·
				<a href={resolve('/part/[id]', { id: String(part.id) })}>{part.title}</a>
			{/snippet}
		</TitleBlock>

		<StorySurface {doc} title={chapter.title} />
	</PageFrame>
{:else}
	<Missing noun="chapter" />
{/if}
