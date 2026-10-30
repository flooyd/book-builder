<script lang="ts">
	import { booksRefresh, modalStore, booksStore, partsStore } from '$lib/stores';

	let {
		title,
		part,
		chapter,
		description,
		category,
		type
	}: {
		category: string;
		type: string;
		title?: string;
		part?: string;
		chapter?: string;
		description?: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let bookValue = $state(title ?? '');
	// svelte-ignore state_referenced_locally
	let descriptionValue = $state(description ?? '');
	// svelte-ignore state_referenced_locally
	let partValue = $state(part ?? '');
	// svelte-ignore state_referenced_locally
	let partDescriptionValue = $state(description ?? '');
	let partHasChaptersValue = $state(true);
	let partBookValue = $state<number | ''>('');
	// svelte-ignore state_referenced_locally
	let chapterValue = $state(chapter ?? '');
	// svelte-ignore state_referenced_locally
	let chapterDescriptionValue = $state(chapter ?? '');
	// svelte-ignore state_referenced_locally
	let chapterPartValue = $state(chapter ?? '');

	$effect(() => {
		bookValue = title ?? '';
		descriptionValue = description ?? '';
		partValue = part ?? '';
		chapterValue = chapter ?? '';
	});

	const getModalTitle = () => {
		if (type === 'create') {
			return 'Create New ' + category.charAt(0).toUpperCase() + category.slice(1);
		} else if (type === 'edit') {
			return 'Edit ' + category.charAt(0).toUpperCase() + category.slice(1);
		} else if (type === 'delete') {
			return 'Delete ' + category.charAt(0).toUpperCase() + category.slice(1);
		}
	};

	const createBook = async () => {
		const response = await fetch('/api/books', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ title: bookValue, description: descriptionValue })
		});
		const data = await response.json();
		if (response.ok) {
			booksRefresh.update((n) => n + 1);
			modalStore.set(null);
		} else {
			console.error(data);
		}
	};

	const createPart = async () => {
		if (!partBookValue) {
			console.error('Select a Book before creating a Part');
			return;
		}

		const response = await fetch('/api/parts', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: partValue,
				description: partDescriptionValue,
				hasChapters: partHasChaptersValue ? 1 : 0,
				bookId: Number(partBookValue)
			})
		});
		const data = await response.json();
		if (response.ok) {
			booksRefresh.update((n) => n + 1);
			modalStore.set(null);
		} else {
			console.error(data);
		}
	};

	const createChapter = async () => {
		if (!chapterPartValue) {
			console.error('Select a Part before creating a Chapter');
			return;
		}

		const response = await fetch('/api/chapters', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				title: chapterValue,
				description: chapterDescriptionValue,
				partId: chapterPartValue
			})
		});
		const data = await response.json();
		if (response.ok) {
			booksRefresh.update((n) => n + 1);
			modalStore.set(null);
		} else {
			console.error(data);
		}
	};
</script>

<div class="modal card">
	<div class="modal-title">
		<h1>{getModalTitle()}</h1>
		<button onclick={() => modalStore.set(null)}>X</button>
	</div>
	<div class="modal-content">
		{#if category === 'book'}
			<div class="control">
				<label for="title">Title</label>
				<input type="text" id="bookValue" bind:value={bookValue} />
			</div>
			<div class="control">
				<label for="description">Description</label>
				<textarea id="description" bind:value={descriptionValue}></textarea>
			</div>
			<button onclick={createBook}>Create Book</button>
		{/if}
		{#if category === 'part'}
			<div class="control">
				<label for="part">Title</label>
				<input type="text" id="partValue" bind:value={partValue} />
			</div>
			<div class="control">
				<label for="partDescription">Description</label>
				<textarea id="partDescription" bind:value={partDescriptionValue}></textarea>
			</div>
			<div class="control inline">
				<label for="partHasChapters">Has Chapters</label>
				<input type="checkbox" id="partHasChapters" bind:checked={partHasChaptersValue} />
			</div>
			<div class="control">
				<label for="book">Book</label>
				<select id="book" bind:value={partBookValue}>
					<option value="">Select a Book</option>
					{#each $booksStore as book (book.id)}
						<option value={book.id}>{book.title}</option>
					{/each}
				</select>
			</div>
			<button onclick={createPart}>Create Part</button>
		{/if}
		{#if category === 'chapter'}
			<div class="control">
				<label for="chapter">Title</label>
				<input type="text" id="chapterValue" bind:value={chapterValue} />
			</div>
			<div class="control">
				<label for="chapterDescription">Description</label>
				<textarea id="chapterDescription" bind:value={chapterDescriptionValue}></textarea>
			</div>
			<div class="control">
				<label for="chapterPartValue">Part</label>
				<select id="chapterPartValue" bind:value={chapterPartValue}>
					<option value="">Select a Part</option>
					{#each $partsStore as part (part.id)}
						<option value={part.id}>{part.title}</option>
					{/each}
				</select>
			</div>
			<button onclick={createChapter}>Create Chapter</button>
		{/if}
	</div>
</div>

<style>
	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 75%;
		height: fit-content;
		color: white;
		padding: 9.89px;
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-control);
		border-radius: var(--r-card);
		z-index: 30;
	}

	.modal-title {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 16px;
	}

	.modal-title h1 {
		margin: 0px;
	}
</style>
