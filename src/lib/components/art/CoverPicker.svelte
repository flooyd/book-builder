<script lang="ts">
	import { resolve } from '$app/paths';
	import { coverOf, type ArtPicture } from '$lib/art';
	import { setCover, usedBytes } from '$lib/art-shelf';
	import BookCover from '$lib/components/ui/BookCover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { artStore, artUploadsOpen, type Book } from '$lib/stores';
	import RoomMeter from './RoomMeter.svelte';
	import UploadButton from './UploadButton.svelte';

	// Choosing a book's cover: the one drawn from its title, or any picture on the writer's art
	// shelf. A picture can be uploaded from here and goes straight on, and the studio is a link away.
	// A choice is saved as soon as it's made.
	let {
		book,
		author = '',
		onclose
	}: { book: Book; author?: string; onclose: () => void } = $props();

	const uid = $props.id();
	let busy = $state<number | 'drawn' | null>(null);
	let error = $state('');

	async function choose(artId: number | null) {
		if (busy !== null || artId === book.coverArtId) return;
		busy = artId ?? 'drawn';
		error = '';
		try {
			await setCover(book.id, artId);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : 'Couldn’t change the cover.';
		} finally {
			busy = null;
		}
	}

	const uploaded = (picture: ArtPicture) => choose(picture.id);
</script>

<Dialog labelledby="{uid}-title" {onclose} width={720}>
	<div class="picker">
		<header>
			<h2 id="{uid}-title">Choose a cover</h2>
			<p>
				For <em>{book.title}</em>. It shows on your library, the book’s page, reading mode, share
				links and the PDF.
			</p>
		</header>

		<ul class="choices" aria-label="Covers">
			<li>
				<button
					type="button"
					class="choice"
					aria-pressed={book.coverArtId === null}
					disabled={busy !== null}
					onclick={() => choose(null)}
				>
					<span class="frame"><BookCover id={book.id} title={book.title} {author} /></span>
					<span class="name">Drawn from the title</span>
				</button>
			</li>
			{#each $artStore as picture (picture.id)}
				<li>
					<button
						type="button"
						class="choice"
						aria-pressed={book.coverArtId === picture.id}
						disabled={busy !== null}
						onclick={() => choose(picture.id)}
					>
						<span class="frame">
							<BookCover id={book.id} title={book.title} art={coverOf(picture)} />
						</span>
						<span class="name">{picture.title || 'Untitled picture'}</span>
						{#if busy === picture.id}<span class="saving">Saving…</span>{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if $artStore.length === 0}
			<p class="hint">
				Your art shelf is empty. Upload a picture, or make one in the studio and save it to your
				shelf.
			</p>
		{/if}

		{#if error}
			<p class="error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
		{/if}

		<footer>
			<div class="add">
				{#if $artUploadsOpen}
					<UploadButton onuploaded={uploaded} onerror={(message) => (error = message)} />
				{/if}
				<Button href={resolve('/studio')}
					><Icon name="palette" size={16} />Make one in the studio</Button
				>
			</div>
			<Button variant="primary" onclick={onclose}>Done</Button>
		</footer>
		{#if $artUploadsOpen}
			<div class="room"><RoomMeter used={usedBytes($artStore)} compact /></div>
		{/if}
		{#if !$artUploadsOpen}
			<p class="hint">Uploading pictures isn’t available on this site yet.</p>
		{/if}
	</div>
</Dialog>

<style>
	.picker {
		padding: 26px 28px 22px;
		font-family: var(--font-ui);
	}

	h2 {
		margin: 0 0 6px;
		color: var(--bb-text-strong);
		font: 400 24px / 1.2 var(--font-display);
	}

	header p {
		margin: 0;
		color: var(--bb-text-2);
		line-height: 1.5;
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 14px;
		max-height: min(52vh, 520px);
		margin: 20px 0 0;
		padding: 4px;
		overflow-y: auto;
		list-style: none;
	}

	.choice {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 14px 10px 10px;
		border: 1px solid var(--bb-line-faint);
		border-radius: var(--r-row);
		background: transparent;
		color: var(--bb-text);
		font: inherit;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background-color 0.15s;
	}

	.choice:hover:not(:disabled) {
		border-color: var(--bb-line-control);
		background: var(--bb-hover);
	}

	.choice[aria-pressed='true'] {
		border-color: var(--bb-sky);
		box-shadow: inset 0 0 0 1px var(--bb-sky);
	}

	.choice:disabled {
		cursor: default;
	}

	.frame {
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.name {
		max-width: 100%;
		overflow: hidden;
		font-size: 13px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.choice[aria-pressed='true'] .name {
		color: var(--bb-sky);
	}

	.saving {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 2px 8px;
		border-radius: var(--r-pill);
		background: var(--bb-raised);
		color: var(--bb-text-2);
		font-size: 11.5px;
	}

	.hint {
		margin: 14px 0 0;
		color: var(--bb-text-3);
		font-size: 14px;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 14px 0 0;
		color: var(--bb-coral);
		font-size: 14px;
	}

	footer {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 16px;
		margin-top: 20px;
	}

	.room {
		max-width: 280px;
		margin-top: 16px;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 16px;
	}

	@media (max-width: 600px) {
		.picker {
			padding: 22px 18px 18px;
		}

		.choices {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
	}
</style>
