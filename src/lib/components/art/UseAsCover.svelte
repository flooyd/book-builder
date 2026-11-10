<script lang="ts">
	import { coverFrom, type ArtPicture } from '$lib/art';
	import { setCover } from '$lib/art-shelf';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { artStore, booksStore, userStore } from '$lib/stores';

	// Putting one picture on the covers of books: every book is listed with the cover it has now,
	// and pressing one puts this picture on it, or takes it off again. Saved as it's pressed.
	let { picture, onclose }: { picture: ArtPicture; onclose: () => void } = $props();

	const uid = $props.id();
	let busy = $state<number | null>(null);
	let error = $state('');

	async function toggle(bookId: number, on: boolean) {
		if (busy !== null) return;
		busy = bookId;
		error = '';
		try {
			await setCover(bookId, on ? null : picture.id);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : 'Couldn’t change the cover.';
		} finally {
			busy = null;
		}
	}
</script>

<Dialog labelledby="{uid}-title" {onclose} width={520}>
	<div class="use">
		<h2 id="{uid}-title">Use as a cover</h2>
		<p class="lede">
			Choose the books “{picture.title || 'this picture'}” goes on. Press one again to go back to
			its drawn cover.
		</p>

		{#if $booksStore.length === 0}
			<p class="hint">You have no books yet. Start one from your library first.</p>
		{:else}
			<ul>
				{#each $booksStore as book (book.id)}
					{@const on = book.coverArtId === picture.id}
					<li>
						<button
							type="button"
							class="book"
							aria-pressed={on}
							disabled={busy !== null}
							onclick={() => toggle(book.id, on)}
						>
							<BookCover
								id={book.id}
								title={book.title}
								author={$userStore?.name}
								size="sm"
								art={coverFrom($artStore, book.coverArtId)}
							/>
							<span class="text">
								<span class="title">{book.title}</span>
								<span class="state">
									{#if busy === book.id}Saving…{:else if on}On its cover{:else if book.coverArtId}Has
										another picture{:else}Drawn cover{/if}
								</span>
							</span>
							{#if on}<Icon name="check-circle" size={20} />{/if}
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if error}
			<p class="error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
		{/if}

		<div class="actions">
			<Button variant="primary" onclick={onclose}>Done</Button>
		</div>
	</div>
</Dialog>

<style>
	.use {
		padding: 26px 28px 22px;
		font-family: var(--font-ui);
	}

	h2 {
		margin: 0 0 6px;
		color: var(--bb-text-strong);
		font: 400 24px / 1.2 var(--font-display);
	}

	.lede,
	.hint {
		margin: 0;
		color: var(--bb-text-2);
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	ul {
		display: grid;
		gap: 6px;
		max-height: min(50vh, 460px);
		margin: 18px 0 0;
		padding: 2px;
		overflow-y: auto;
		list-style: none;
	}

	.book {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 76px;
		padding: 6px 14px 6px 6px;
		border: 1px solid var(--bb-line-faint);
		border-radius: var(--r-row);
		background: transparent;
		color: var(--bb-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.book:hover:not(:disabled) {
		border-color: var(--bb-line-control);
		background: var(--bb-hover);
	}

	.book[aria-pressed='true'] {
		border-color: var(--bb-sky);
		color: var(--bb-sky);
	}

	.text {
		display: grid;
		flex: 1;
		min-width: 0;
		gap: 2px;
	}

	.title {
		overflow: hidden;
		color: var(--bb-text-strong);
		font: 400 17px / 1.25 var(--font-display);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.state {
		color: var(--bb-text-3);
		font-size: 13px;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 14px 0 0;
		color: var(--bb-coral);
		font-size: 14px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 18px;
	}

	@media (max-width: 600px) {
		.use {
			padding: 22px 18px 18px;
		}
	}
</style>
