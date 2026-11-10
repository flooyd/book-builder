<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { DESCRIPTION_LIMIT, formatBytes, TITLE_LIMIT, type ArtPicture } from '$lib/art';
	import {
		coversWith,
		deletePicture,
		describePicture,
		refreshShelf,
		usedBytes
	} from '$lib/art-shelf';
	import { listDrafts } from '$lib/studio/draft';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { artStore, artUploadsOpen, booksStore, libraryStatus } from '$lib/stores';
	import RoomMeter from './RoomMeter.svelte';
	import UploadButton from './UploadButton.svelte';
	import UseAsCover from './UseAsCover.svelte';

	// The art shelf (idea 18): every picture a writer has uploaded or saved from the studio, kept
	// online with their account, with the room left and the books each one is the cover of. From
	// here a picture goes on covers, gets a name and a description, or comes off the shelf.
	let { owner }: { owner: string } = $props();

	useAppHeader((header) => {
		header.crumbs = [{ label: 'Art shelf' }];
	});

	let loaded = $state(false);
	let error = $state('');
	/** Studio drawings in this browser, so a picture saved from one can open it again. */
	let drafts = $state<string[]>([]);
	let covering = $state<ArtPicture | null>(null);
	let editing = $state<ArtPicture | null>(null);
	let doomed = $state<ArtPicture | null>(null);

	onMount(() => {
		refreshShelf()
			.catch(() => (error = 'Couldn’t load your pictures. Try again in a moment.'))
			.finally(() => (loaded = true));
		listDrafts(owner)
			.then((found) => (drafts = found.map((draft) => draft.key)))
			.catch(() => {});
	});

	const used = $derived(usedBytes($artStore));
	const ready = $derived(loaded || $libraryStatus === 'ready');

	// Editing a picture's name and description.
	let draftTitle = $state('');
	let draftDescription = $state('');
	let saving = $state(false);
	let editError = $state('');

	function startEdit(picture: ArtPicture) {
		editing = picture;
		draftTitle = picture.title;
		draftDescription = picture.description;
		editError = '';
	}

	async function saveEdit(event: SubmitEvent) {
		event.preventDefault();
		if (!editing) return;
		saving = true;
		editError = '';
		try {
			await describePicture(editing.id, { title: draftTitle, description: draftDescription });
			editing = null;
		} catch (problem) {
			editError = problem instanceof Error ? problem.message : 'Couldn’t save it.';
		} finally {
			saving = false;
		}
	}

	let deleting = $state(false);
	let deleteError = $state('');

	async function remove() {
		if (!doomed) return;
		deleting = true;
		deleteError = '';
		try {
			await deletePicture(doomed.id);
			doomed = null;
		} catch (problem) {
			deleteError = problem instanceof Error ? problem.message : 'Couldn’t delete it.';
		} finally {
			deleting = false;
		}
	}

	const doomedCovers = $derived(doomed ? coversWith($booksStore, doomed.id) : []);
	const titles = (list: { title: string }[]) => {
		const names = list.map((item) => `“${item.title}”`);
		return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
	};
</script>

<svelte:head>
	<title>Art shelf · Book Builder</title>
</svelte:head>

<div class="shelf">
	<header class="top">
		<div>
			<p class="overline">Art shelf</p>
			<h1>Your pictures</h1>
			<p class="lede">
				Covers and pictures you’ve uploaded or saved from the studio. They’re kept with your
				account, so they’re here on every device.
			</p>
		</div>
		<div class="top-side">
			<div class="top-actions">
				<Button href={resolve('/studio')}><Icon name="palette" size={16} />Open the studio</Button>
				{#if $artUploadsOpen}
					<UploadButton variant="primary" onerror={(message) => (error = message)} />
				{/if}
			</div>
			{#if $artUploadsOpen}<RoomMeter {used} />{/if}
		</div>
	</header>

	{#if !$artUploadsOpen}
		<p class="notice">
			<Icon name="info" size={16} />Uploading pictures isn’t available on this site yet.
		</p>
	{/if}
	{#if error}
		<p class="notice error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
	{/if}

	{#if !ready}
		<p class="quiet" aria-busy="true">Looking for your pictures…</p>
	{:else if $artStore.length === 0}
		<div class="empty">
			<span class="empty-art" aria-hidden="true"><Icon name="image" size={30} /></span>
			<h2>No pictures yet</h2>
			<p>Upload a picture, or make one in the studio and save it to your shelf.</p>
			<Button variant="primary" href={resolve('/studio')}>Open the studio</Button>
		</div>
	{:else}
		<ul class="grid">
			{#each $artStore as picture (picture.id)}
				{@const covers = coversWith($booksStore, picture.id)}
				<li class="card">
					<div class="frame">
						<img
							src={picture.smallUrl}
							alt={picture.description}
							loading="lazy"
							style:aspect-ratio="{picture.width} / {picture.height}"
						/>
					</div>
					<div class="text">
						<p class="name">{picture.title || 'Untitled picture'}</p>
						<p class="meta">
							{picture.width} × {picture.height} · {formatBytes(picture.bytes)} · {picture.source ===
							'studio'
								? 'From the studio'
								: 'Uploaded'}
						</p>
						{#if covers.length}
							<p class="uses">
								<Icon name="book" size={13} />Cover of {titles(covers)}
							</p>
						{/if}
					</div>
					<div class="actions">
						<Button onclick={() => (covering = picture)}>Use as a cover</Button>
						{#if picture.draftKey && drafts.includes(picture.draftKey)}
							<a
								class="icon"
								href={resolve('/studio/draft/[key]', { key: picture.draftKey })}
								aria-label="Open the drawing in the studio"
								title="Open the drawing in the studio"
							>
								<Icon name="palette" size={16} />
							</a>
						{/if}
						<button
							type="button"
							class="icon"
							aria-label="Name and describe {picture.title || 'this picture'}"
							title="Name and describe"
							onclick={() => startEdit(picture)}
						>
							<Icon name="pen" size={16} />
						</button>
						<button
							type="button"
							class="icon danger"
							aria-label="Delete {picture.title || 'this picture'}"
							title="Delete"
							onclick={() => {
								deleteError = '';
								doomed = picture;
							}}
						>
							<Icon name="trash" size={16} />
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if covering}
	<UseAsCover picture={covering} onclose={() => (covering = null)} />
{/if}

{#if editing}
	<Dialog labelledby="edit-picture-title" onclose={() => (editing = null)} width={520}>
		<form class="dialog" onsubmit={saveEdit}>
			<h2 id="edit-picture-title">Name and describe</h2>
			<label>
				<span>Name</span>
				<input bind:value={draftTitle} maxlength={TITLE_LIMIT} autocomplete="off" />
			</label>
			<label>
				<span>Description</span>
				<textarea
					bind:value={draftDescription}
					maxlength={DESCRIPTION_LIMIT}
					rows="4"
					placeholder="What it shows, for people who can’t see it"></textarea>
			</label>
			{#if editError}
				<p class="notice error" role="alert"><Icon name="alert-circle" size={16} />{editError}</p>
			{/if}
			<div class="dialog-actions">
				<Button variant="quiet" onclick={() => (editing = null)}>Cancel</Button>
				<Button type="submit" variant="primary" disabled={saving}
					>{saving ? 'Saving…' : 'Save'}</Button
				>
			</div>
		</form>
	</Dialog>
{/if}

{#if doomed}
	<Dialog labelledby="delete-picture-title" onclose={() => (doomed = null)} width={480}>
		<div class="dialog">
			<h2 id="delete-picture-title">Delete “{doomed.title || 'Untitled picture'}”?</h2>
			<p>
				It comes off your shelf for good.
				{#if doomedCovers.length}
					{`It’s the cover of ${titles(doomedCovers)}, which will go back to ${
						doomedCovers.length === 1 ? 'a cover' : 'covers'
					} drawn from the title.`}
				{/if}
				{#if doomed.source === 'studio'}
					The drawing itself stays in the studio, in the browser it was made in.
				{/if}
			</p>
			{#if deleteError}
				<p class="notice error" role="alert"><Icon name="alert-circle" size={16} />{deleteError}</p>
			{/if}
			<div class="dialog-actions">
				<Button variant="quiet" onclick={() => (doomed = null)}>Keep it</Button>
				<Button variant="danger" disabled={deleting} onclick={remove}
					>{deleting ? 'Deleting…' : 'Delete'}</Button
				>
			</div>
		</div>
	</Dialog>
{/if}

<style>
	.shelf {
		max-width: 1280px;
		margin: 0 auto;
		padding: 40px 32px 80px;
		font-family: var(--font-ui);
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px 40px;
		margin-bottom: 32px;
	}

	.top-side {
		display: grid;
		justify-items: end;
		gap: 16px;
	}

	.top-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.top-side :global(.room) {
		width: 100%;
	}

	.overline {
		margin: 0 0 8px;
		color: var(--bb-sky);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		color: var(--bb-text-strong);
		font: 400 clamp(32px, 5vw, 44px) / 1.1 var(--font-display);
	}

	.lede {
		max-width: 560px;
		margin: 12px 0 0;
		color: var(--bb-text-desc);
		font: 400 17px / 1.55 var(--font-read);
	}

	.quiet {
		color: var(--bb-text-3);
	}

	.notice {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 20px;
		color: var(--bb-text-2);
		font-size: 14px;
	}

	.notice.error {
		color: var(--bb-coral);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 28px 24px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.frame {
		display: grid;
		place-items: center;
		height: 240px;
		padding: 18px;
		border: 1px solid var(--bb-line-faint);
		border-radius: 14px;
		background: light-dark(#e9e4d9, #070b1c);
	}

	/* A length, not 100%: a percentage height doesn't hold the picture inside the grid cell. */
	.frame img {
		display: block;
		max-width: 100%;
		max-height: 204px;
		box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.5);
		background: repeating-conic-gradient(#e3e3e3 0 25%, #fff 0 50%) 0 0 / 12px 12px;
	}

	.text {
		display: grid;
		gap: 3px;
		min-width: 0;
	}

	.text p {
		margin: 0;
	}

	.name {
		overflow: hidden;
		color: var(--bb-text-strong);
		font-size: 15px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		color: var(--bb-text-3);
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
	}

	.uses {
		display: flex;
		align-items: baseline;
		gap: 6px;
		color: var(--bb-sky);
		font-size: 13px;
		overflow-wrap: anywhere;
	}

	.uses :global(svg) {
		flex: none;
		transform: translateY(2px);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: auto;
	}

	.actions :global(.press:first-child) {
		margin-right: auto;
	}

	.icon {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 1px solid var(--bb-line-soft);
		border-radius: var(--r-control);
		background: transparent;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.icon:hover {
		border-color: var(--bb-line-control);
		color: var(--bb-text-strong);
	}

	.icon.danger:hover {
		color: var(--bb-coral);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 56px 20px;
		border: 1px dashed var(--bb-line-dashed);
		border-radius: var(--r-card);
		text-align: center;
	}

	.empty-art {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--bb-raised);
		color: var(--bb-sky);
	}

	.empty h2 {
		margin: 8px 0 0;
		color: var(--bb-text-strong);
		font: 400 24px var(--font-display);
	}

	.empty p {
		margin: 0 0 10px;
		color: var(--bb-text-2);
	}

	.dialog {
		display: grid;
		gap: 14px;
		padding: 26px 28px 22px;
		font-family: var(--font-ui);
	}

	.dialog h2 {
		margin: 0;
		color: var(--bb-text-strong);
		font: 400 22px / 1.25 var(--font-display);
		overflow-wrap: anywhere;
	}

	.dialog p {
		margin: 0;
		color: var(--bb-text-2);
		line-height: 1.55;
	}

	label {
		display: grid;
		gap: 6px;
		color: var(--bb-text-label);
		font-size: 13px;
		font-weight: 600;
	}

	input,
	textarea {
		box-sizing: border-box;
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--bb-line-control);
		border-radius: var(--r-control);
		background: var(--bb-ink);
		color: var(--bb-text-strong);
		font: 400 15px / 1.45 var(--font-ui);
	}

	input {
		min-height: 44px;
	}

	textarea {
		resize: vertical;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 6px;
	}

	@media (max-width: 600px) {
		.shelf {
			padding: 28px 16px 64px;
		}

		.top-side {
			justify-items: stretch;
			width: 100%;
		}

		.grid {
			grid-template-columns: minmax(0, 1fr);
		}

		.dialog {
			padding: 22px 18px 18px;
		}
	}
</style>
