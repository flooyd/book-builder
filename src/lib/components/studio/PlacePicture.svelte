<script lang="ts">
	import type { ArtPicture } from '$lib/art';
	import { PICK_TYPES, titleFromFile } from '$lib/art-upload';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { MAX_PICTURES } from '$lib/drawing';
	import { fetchPicture, readPicture, type Picture } from '$lib/studio/pictures';
	import type { Studio } from '$lib/studio/studio.svelte';
	import ShelfPicker from './ShelfPicker.svelte';

	// Putting a picture in the drawing, to trace over or build on: from a file on the device or
	// from the art shelf. It goes in the middle of the drawing, on top of the active layer, picked,
	// and stays in this browser with the drawing (nothing is uploaded).
	let {
		studio,
		across = false,
		onplaced
	}: {
		studio: Studio;
		/** Laid out across, in the small-screen strip: the menu opens above. */
		across?: boolean;
		/** After a picture goes in (the small-screen strip closes its sheet, say). */
		onplaced?: () => void;
	} = $props();

	const menuId = `place-${Math.random().toString(36).slice(2, 8)}`;
	let menu = $state<HTMLElement>();
	let trigger = $state<HTMLElement>();
	let input: HTMLInputElement;
	let busy = $state(false);
	let picking = $state(false);
	let fetching = $state<number | null>(null);
	let shelfError = $state('');
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	const keep = (event: MouseEvent) => event.preventDefault();
	$effect(() => () => clearTimeout(noticeTimer));

	function say(message: string) {
		notice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 7000);
	}

	const FULL = `This drawing holds as many pictures as it can (${MAX_PICTURES}). Delete one to put in another.`;

	function placeMenu(event: ToggleEvent) {
		if (event.newState !== 'open' || !menu || !trigger) return;
		// Before it opens it has no size yet, so above the strip it's placed by its bottom edge.
		const box = trigger.getBoundingClientRect();
		const width = 230;
		if (across) {
			menu.style.left = `${Math.max(8, Math.min(box.left, innerWidth - width - 8))}px`;
			menu.style.top = 'auto';
			menu.style.bottom = `${innerHeight - box.top + 8}px`;
		} else {
			menu.style.left = `${box.right + 8}px`;
			menu.style.top = `${box.top - 6}px`;
			menu.style.bottom = 'auto';
		}
	}

	function place(picture: Picture, name: string) {
		if (!studio.placePicture(picture, name)) {
			picture.bitmap.close();
			say(FULL);
			return false;
		}
		onplaced?.();
		return true;
	}

	function fromDevice() {
		menu?.hidePopover();
		if (!studio.pictureRoom()) return say(FULL);
		input.click();
	}

	async function chosen() {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		notice = '';
		try {
			place(await readPicture(file), titleFromFile(file.name));
		} catch (problem) {
			say(problem instanceof Error ? problem.message : 'Couldn’t put the picture in.');
		} finally {
			busy = false;
		}
	}

	function fromShelf() {
		menu?.hidePopover();
		if (!studio.pictureRoom()) return say(FULL);
		shelfError = '';
		picking = true;
	}

	async function chooseFromShelf(art: ArtPicture) {
		if (fetching !== null) return;
		fetching = art.id;
		shelfError = '';
		try {
			const picture = await fetchPicture(art.url);
			if (place(picture, art.title)) picking = false;
		} catch (problem) {
			shelfError = problem instanceof Error ? problem.message : 'Couldn’t bring the picture in.';
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
<button
	bind:this={trigger}
	type="button"
	class="tool"
	popovertarget={menuId}
	disabled={busy}
	aria-busy={busy}
	aria-label="Put in a picture"
	title={busy ? 'Bringing the picture in…' : 'Put in a picture, to trace over or build on'}
	onmousedown={keep}
>
	<Icon name="image-plus" size={19} strokeWidth={1.8} />
</button>

<div
	bind:this={menu}
	id={menuId}
	class="menu"
	popover="auto"
	role="menu"
	aria-label="Put in a picture"
	onbeforetoggle={placeMenu}
>
	<p class="menu-note">To trace over or build on. It stays with the drawing in this browser.</p>
	<button type="button" role="menuitem" class="item" onclick={fromDevice}>
		<Icon name="upload" size={17} strokeWidth={1.8} />
		<span>From this device…</span>
	</button>
	<button type="button" role="menuitem" class="item" onclick={fromShelf}>
		<Icon name="image" size={17} strokeWidth={1.8} />
		<span>From your art shelf…</span>
	</button>
</div>

{#if notice}
	<p class="notice" role="alert">
		<Icon name="alert-circle" size={16} />
		<span>{notice}</span>
		<button type="button" aria-label="Close" onclick={() => (notice = '')}>
			<Icon name="x" size={14} />
		</button>
	</p>
{/if}

{#if picking}
	<ShelfPicker
		title="Put in a picture from your shelf"
		busy={fetching}
		error={shelfError}
		onchoose={chooseFromShelf}
		onclose={() => (picking = false)}
	/>
{/if}

<style>
	.tool {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--bb-text-label);
	}

	.tool:hover:not(:disabled) {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.tool:disabled {
		opacity: 0.5;
	}

	.menu {
		position: fixed;
		inset: auto;
		width: 230px;
		margin: 0;
		padding: 6px;
		border: 1px solid var(--bb-line-control);
		border-radius: 12px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font-family: var(--font-ui);
	}

	.menu-note {
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
		min-height: 38px;
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

	.notice {
		position: fixed;
		top: 64px;
		left: 50%;
		z-index: 6;
		display: flex;
		align-items: center;
		gap: 8px;
		width: max-content;
		max-width: calc(100vw - 32px);
		margin: 0;
		padding: 8px 8px 8px 12px;
		border: 1px solid var(--bb-line-control);
		border-radius: 12px;
		background: var(--bb-ink);
		color: var(--bb-text-strong);
		box-shadow: 0 18px 40px -18px var(--bb-drop);
		font: 500 13.5px / 1.4 var(--font-ui);
		transform: translateX(-50%);
	}

	.notice > :global(svg) {
		flex: none;
		color: var(--bb-coral);
	}

	.notice button {
		display: grid;
		flex: none;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 7px;
		background: none;
		color: var(--bb-text-3);
	}

	.notice button:hover {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}
</style>
