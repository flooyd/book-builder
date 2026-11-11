<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ArtPicture } from '$lib/art';
	import { refreshShelf } from '$lib/art-shelf';
	import UploadButton from '$lib/components/art/UploadButton.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { artStore, artUploadsOpen } from '$lib/stores';

	// Picking a picture from the writer's art shelf: to put in a drawing or start one from (the
	// studio copies what's picked into the drawing, see $lib/studio/pictures, so it can be changed
	// there without touching the shelf's copy), or to set in story text. With `upload`, a picture
	// can be uploaded from here, and it's chosen as soon as it's on the shelf.
	let {
		title = 'Choose a picture from your shelf',
		note = 'A copy goes into the drawing, so changing it there leaves your shelf as it is.',
		upload = false,
		busy = null,
		error = '',
		onchoose,
		onclose
	}: {
		title?: string;
		note?: string;
		upload?: boolean;
		/** The picture being fetched, if one is. */
		busy?: number | null;
		error?: string;
		onchoose: (picture: ArtPicture) => void;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	let loading = $state($artStore.length === 0);
	let failed = $state(false);
	let uploadError = $state('');

	onMount(() => {
		refreshShelf()
			.catch(() => (failed = $artStore.length === 0))
			.finally(() => (loading = false));
	});
</script>

<Dialog labelledby="{uid}-title" {onclose} width={680}>
	<div class="picker">
		<header>
			<h2 id="{uid}-title">{title}</h2>
			<p>{note}</p>
		</header>

		{#if $artStore.length}
			<ul class="choices" aria-label="Your pictures">
				{#each $artStore as picture (picture.id)}
					<li>
						<button
							type="button"
							class="choice"
							disabled={busy !== null}
							aria-busy={busy === picture.id}
							onclick={() => onchoose(picture)}
						>
							<span class="frame">
								<img src={picture.smallUrl} alt="" loading="lazy" decoding="async" />
							</span>
							<span class="name">{picture.title || 'Untitled picture'}</span>
							<span class="size">
								{busy === picture.id ? 'Bringing it in…' : `${picture.width} × ${picture.height}`}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if loading}
			<p class="hint" aria-busy="true">Looking for your pictures…</p>
		{:else if failed}
			<p class="hint">Couldn’t load your pictures. Check the connection and try again.</p>
		{:else}
			<p class="hint">
				Your art shelf is empty. Pictures you upload there, or save from the studio, show here.
			</p>
		{/if}

		{#if error || uploadError}
			<p class="error" role="alert">
				<Icon name="alert-circle" size={16} />{error || uploadError}
			</p>
		{/if}

		<footer>
			{#if upload && $artUploadsOpen}
				<UploadButton
					disabled={busy !== null}
					onuploaded={onchoose}
					onerror={(message) => (uploadError = message)}
				/>
			{:else}
				<a class="shelf-link" href={resolve('/art')}>Open your art shelf</a>
			{/if}
			<Button onclick={onclose}>Cancel</Button>
		</footer>
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
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
		max-height: min(52vh, 520px);
		margin: 20px 0 0;
		padding: 4px;
		overflow-y: auto;
		list-style: none;
	}

	.choice {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		padding: 8px;
		border: 1px solid var(--bb-line-soft);
		border-radius: var(--r-row);
		background: var(--bb-panel);
		color: var(--bb-text);
		text-align: left;
	}

	.choice:hover:not(:disabled) {
		border-color: var(--bb-sky);
	}

	.choice:disabled {
		opacity: 0.6;
	}

	.choice[aria-busy='true'] {
		opacity: 1;
		border-color: var(--bb-sky);
	}

	.frame {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: 9px;
		/* A checkerboard, for pictures that are see-through. */
		background: repeating-conic-gradient(#e3e3e3 0 25%, #ffffff 0 50%) 0 0 / 16px 16px;
	}

	.frame img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.name {
		overflow: hidden;
		color: var(--bb-text-strong);
		font-size: 13.5px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.size {
		color: var(--bb-text-3);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.hint {
		margin: 20px 0 0;
		color: var(--bb-text-2);
		line-height: 1.5;
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 16px 0 0;
		color: var(--bb-coral);
		font-size: 14px;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 20px;
	}

	.shelf-link {
		color: var(--bb-sky);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}

	.shelf-link:hover {
		text-decoration: underline;
	}

	@media (max-width: 600px) {
		.picker {
			padding: 22px 16px 18px;
		}

		.choices {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
