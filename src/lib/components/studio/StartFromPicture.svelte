<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ArtPicture } from '$lib/art';
	import { PICK_TYPES, titleFromFile } from '$lib/art-upload';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { fetchPicture, readPicture, type Picture } from '$lib/studio/pictures';
	import { startFromPicture } from '$lib/studio/start';
	import ShelfPicker from './ShelfPicker.svelte';

	// Starting a drawing from a picture, from the device or the art shelf: the drawing takes the
	// picture's size, with the picture locked on the bottom layer and an empty layer to draw on above.
	// It's all made in this browser; nothing is uploaded.
	let { owner }: { owner: string } = $props();

	const menuId = `start-${Math.random().toString(36).slice(2, 8)}`;
	let menu = $state<HTMLElement>();
	let input: HTMLInputElement;
	let busy = $state(false);
	let picking = $state(false);
	let fetching = $state<number | null>(null);
	let error = $state('');

	async function open(picture: Picture, name: string) {
		const key = await startFromPicture(owner, picture, name);
		picture.bitmap.close();
		await goto(resolve('/studio/draft/[key]', { key }));
	}

	function fromDevice() {
		menu?.hidePopover();
		error = '';
		input.click();
	}

	async function chosen() {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		error = '';
		try {
			await open(await readPicture(file), titleFromFile(file.name));
		} catch (problem) {
			error = problem instanceof Error ? problem.message : 'Couldn’t start from that picture.';
		} finally {
			busy = false;
		}
	}

	async function chooseFromShelf(art: ArtPicture) {
		if (fetching !== null) return;
		fetching = art.id;
		error = '';
		try {
			await open(await fetchPicture(art.url), art.title);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : 'Couldn’t bring the picture in.';
		} finally {
			fetching = null;
		}
	}
</script>

<input
	bind:this={input}
	class="sr-only"
	type="file"
	accept={PICK_TYPES}
	tabindex="-1"
	aria-hidden="true"
	onchange={chosen}
/>
<span class="anchor">
	<Button size="lg" popovertarget={menuId} disabled={busy} aria-busy={busy}>
		<Icon name="image-plus" size={18} />
		{busy ? 'Opening…' : 'From a picture'}
	</Button>
	<div
		bind:this={menu}
		id={menuId}
		class="menu"
		popover="auto"
		role="menu"
		aria-label="Start from a picture"
	>
		<p class="note">
			The drawing takes the picture’s size, with an empty layer above it to draw on.
		</p>
		<button type="button" role="menuitem" class="item" onclick={fromDevice}>
			<Icon name="upload" size={17} strokeWidth={1.8} /><span>From this device…</span>
		</button>
		<button
			type="button"
			role="menuitem"
			class="item"
			onclick={() => {
				menu?.hidePopover();
				error = '';
				picking = true;
			}}
		>
			<Icon name="image" size={17} strokeWidth={1.8} /><span>From your art shelf…</span>
		</button>
	</div>
</span>
{#if error && !picking}
	<p class="error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
{/if}

{#if picking}
	<ShelfPicker
		title="Start from a picture on your shelf"
		busy={fetching}
		{error}
		onchoose={chooseFromShelf}
		onclose={() => (picking = false)}
	/>
{/if}

<style>
	.anchor {
		position: relative;
		anchor-name: --start-picture;
	}

	.menu {
		position: fixed;
		position-anchor: --start-picture;
		inset: auto;
		top: anchor(bottom);
		right: anchor(right);
		width: 250px;
		margin: 8px 0 0;
		padding: 6px;
		border: 1px solid var(--bb-line-control);
		border-radius: 12px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font-family: var(--font-ui);
	}

	.note {
		margin: 4px 8px 8px;
		color: var(--bb-text-3);
		font-size: 12px;
		line-height: 1.45;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 40px;
		padding: 0 10px;
		border: none;
		border-radius: 8px;
		background: none;
		color: var(--bb-text-label);
		font: 500 13.5px var(--font-ui);
		text-align: left;
	}

	.item:hover {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.error {
		display: flex;
		flex-basis: 100%;
		align-items: center;
		gap: 8px;
		margin: 0;
		color: var(--bb-coral);
		font: 500 14px var(--font-ui);
	}
</style>
