<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ArtPicture } from '$lib/art';
	import { savedFrom, savePrepared } from '$lib/art-shelf';
	import { prepare } from '$lib/art-upload';
	import UseAsCover from '$lib/components/art/UseAsCover.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { flatten } from '$lib/studio/render';
	import type { Studio } from '$lib/studio/studio.svelte';
	import { SURPRISES, type SurpriseKind } from '$lib/studio/surprise';
	import { artStore, artUploadsOpen } from '$lib/stores';

	// The studio's top bar: back to the shelf, the drawing's name, whether it's kept, "Surprise me",
	// undo and redo, the zoom, downloading a picture and saving one to the art shelf. On small
	// screens it also opens the panels.
	let {
		studio,
		draftKey,
		title = $bindable(),
		status,
		narrow = false,
		sheet = null,
		onsheet
	}: {
		studio: Studio;
		/** The drawing's key in this browser: saving it again replaces its copy on the shelf. */
		draftKey: string;
		title: string;
		status: 'kept' | 'keeping' | 'failed';
		narrow?: boolean;
		sheet?: 'properties' | 'layers' | null;
		onsheet?: (sheet: 'properties' | 'layers' | null) => void;
	} = $props();

	const zoomId = 'studio-zoom';
	const downloadId = 'studio-download';
	const surpriseId = 'studio-surprise';
	const keep = (event: MouseEvent) => event.preventDefault();

	// "Surprise me" rolls the kind picked last, remembered in this browser.
	const KIND_KEY = 'bb-studio-surprise';
	let kind = $state<SurpriseKind | 'any'>('any');
	let spins = $state(0);
	let notice = $state('');
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	const kindLabel = $derived(SURPRISES.find((item) => item.key === kind)?.label ?? 'Any kind');

	onMount(() => {
		try {
			const saved = localStorage.getItem(KIND_KEY);
			if (saved && SURPRISES.some((item) => item.key === saved)) kind = saved as SurpriseKind;
		} catch {
			// Storage switched off: start from any kind.
		}
		return () => clearTimeout(noticeTimer);
	});

	function roll(next = kind) {
		spins++;
		if (studio.surprise(next)) return;
		notice = 'No room for another picture: the drawing has all the layers or shapes it can hold';
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 6000);
	}

	function choose(next: SurpriseKind | 'any') {
		kind = next;
		try {
			localStorage.setItem(KIND_KEY, next);
		} catch {
			// Not remembered, which is fine.
		}
		document.getElementById(surpriseId)?.hidePopover();
		roll(next);
	}
	const percent = $derived(`${Math.round(studio.view.zoom * 100)}%`);

	const doubleFits = $derived(studio.doc.width * studio.doc.height * 4 <= 4096 * 4096);
	let downloading = $state(false);

	async function download(scale: number) {
		if (downloading) return;
		downloading = true;
		try {
			const canvas = flatten({ doc: studio.doc, paint: studio.paint }, scale);
			const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
			if (!blob) return;
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `${(title.trim() || 'Drawing').replace(/[\\/:*?"<>|]+/g, '')}${scale === 1 ? '' : ` @${scale}x`}.png`;
			document.body.append(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 10_000);
		} finally {
			downloading = false;
			document.getElementById(downloadId)?.hidePopover();
		}
	}

	// Saving to the art shelf: the picture as it looks now, made in this browser and sent straight
	// to storage. A drawing saved before replaces its copy, which keeps every cover it's on.
	const savedId = 'studio-saved';
	let saving = $state(false);
	let saved = $state<ArtPicture | null>(null);
	let covering = $state<ArtPicture | null>(null);
	const onShelf = $derived($artStore.find((picture) => picture.draftKey === draftKey) ?? null);

	async function save() {
		if (saving) return;
		saving = true;
		document.getElementById(savedId)?.hidePopover();
		try {
			const canvas = flatten({ doc: studio.doc, paint: studio.paint });
			const prepared = await prepare(canvas, canvas.width, canvas.height, true);
			const replaces = savedFrom(draftKey);
			saved = await savePrepared(prepared, {
				source: 'studio',
				draftKey,
				title: title.trim() || 'Untitled drawing',
				replaces: replaces?.id ?? null
			});
			savedNote = replaces ? 'Updated on your art shelf' : 'Saved to your art shelf';
		} catch (problem) {
			saved = null;
			savedNote = problem instanceof Error ? problem.message : 'Couldn’t save the picture.';
		} finally {
			saving = false;
		}
		const panel = document.getElementById(savedId);
		const trigger = document.querySelector('.save');
		if (!panel || !trigger) return;
		panel.showPopover();
		const box = trigger.getBoundingClientRect();
		panel.style.top = `${box.bottom + 6}px`;
		const width = panel.offsetWidth || 260;
		panel.style.left = `${Math.max(8, Math.min(box.right - width, innerWidth - width - 8))}px`;
	}
	let savedNote = $state('');

	function zoomItem(run: () => void) {
		run();
		document.getElementById(zoomId)?.hidePopover();
	}

	function placeBelow(event: ToggleEvent, id: string, align: 'start' | 'end') {
		const panel = document.getElementById(id);
		const trigger = document.querySelector(`[popovertarget="${id}"]`);
		if (event.newState !== 'open' || !panel || !trigger) return;
		const box = trigger.getBoundingClientRect();
		panel.style.top = `${box.bottom + 6}px`;
		const width = panel.offsetWidth || 220;
		const left = align === 'start' ? box.left : box.right - width;
		panel.style.left = `${Math.max(8, Math.min(left, innerWidth - width - 8))}px`;
	}

	const STATUS = {
		kept: 'Kept in this browser',
		keeping: 'Keeping…',
		failed: 'Couldn’t keep the latest change'
	};
</script>

<header class="bar">
	<div class="start">
		<a
			class="back"
			href={resolve('/studio')}
			aria-label="Back to your drawings"
			title="Back to your drawings"
		>
			<Icon name="arrow-left" size={18} />
		</a>
		<label class="title">
			<span class="sr-only">Drawing name</span>
			<input
				type="text"
				bind:value={title}
				maxlength="80"
				placeholder="Untitled drawing"
				spellcheck="false"
				onkeydown={(event) => {
					if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
				}}
			/>
		</label>
		<span class="status" class:failed={status === 'failed' || !!notice} role="status">
			{#if status === 'kept' && !notice}<Icon name="check" size={13} />{/if}
			<span class="status-text">{notice || STATUS[status]}</span>
		</span>
	</div>

	<div class="end">
		<div class="surprise">
			<button
				type="button"
				class="roll"
				aria-label="Surprise me"
				title={studio.rerolls
					? 'Another random picture, in place of this one'
					: 'Surprise me: a random picture on a new layer at the top'}
				onmousedown={keep}
				onclick={() => roll()}
			>
				<span class="die" style:transform="rotate({spins * 180}deg)"
					><Icon name="dice" size={16} /></span
				>
				<span class="roll-text">Surprise me</span>
			</button>
			<button
				type="button"
				class="roll-kind"
				popovertarget={surpriseId}
				aria-label="What kind of picture, now {kindLabel}"
				title="What kind of picture"
				onmousedown={keep}
			>
				<Icon name="chevron-down" size={13} />
			</button>
		</div>
		<div
			id={surpriseId}
			class="menu kinds"
			popover="auto"
			role="menu"
			aria-label="What kind of picture"
			onbeforetoggle={(event) => placeBelow(event, surpriseId, 'end')}
		>
			<p class="menu-note">
				A random picture on a new layer at the top, made of shapes you can change. Until you draw on
				it, press again for another in its place.
			</p>
			<button
				type="button"
				role="menuitemradio"
				aria-checked={kind === 'any'}
				onclick={() => choose('any')}
			>
				Any kind
				{#if kind === 'any'}<Icon name="check" size={14} />{/if}
			</button>
			<hr />
			{#each SURPRISES as item (item.key)}
				<button
					type="button"
					role="menuitemradio"
					aria-checked={kind === item.key}
					onclick={() => choose(item.key)}
				>
					{item.label}
					{#if kind === item.key}<Icon name="check" size={14} />{/if}
				</button>
			{/each}
		</div>

		<button
			type="button"
			class="icon"
			aria-label="Undo (Ctrl+Z)"
			title="Undo (Ctrl+Z)"
			disabled={!studio.canUndo}
			onmousedown={keep}
			onclick={() => studio.undo()}
		>
			<Icon name="undo" size={17} />
		</button>
		<button
			type="button"
			class="icon"
			aria-label="Redo (Ctrl+Shift+Z)"
			title="Redo (Ctrl+Shift+Z)"
			disabled={!studio.canRedo}
			onmousedown={keep}
			onclick={() => studio.redo()}
		>
			<Icon name="redo" size={17} />
		</button>

		<button
			type="button"
			class="zoom"
			popovertarget={zoomId}
			aria-label="Zoom, now {percent}"
			onmousedown={keep}
		>
			{percent}
			<Icon name="chevron-down" size={13} />
		</button>
		<div
			id={zoomId}
			class="menu"
			popover="auto"
			role="menu"
			aria-label="Zoom"
			onbeforetoggle={(event) => placeBelow(event, zoomId, 'end')}
		>
			<button type="button" role="menuitem" onclick={() => zoomItem(() => studio.zoomStep(1))}
				>Zoom in <kbd>Ctrl +</kbd></button
			>
			<button type="button" role="menuitem" onclick={() => zoomItem(() => studio.zoomStep(-1))}
				>Zoom out <kbd>Ctrl −</kbd></button
			>
			<hr />
			<button type="button" role="menuitem" onclick={() => zoomItem(() => studio.fit())}
				>Fit the drawing <kbd>Ctrl 0</kbd></button
			>
			<button
				type="button"
				role="menuitem"
				disabled={!studio.selectionBounds}
				onclick={() => zoomItem(() => studio.fit(studio.selectionBounds))}
			>
				Fit the selection <kbd>Ctrl 2</kbd>
			</button>
			<hr />
			<button type="button" role="menuitem" onclick={() => zoomItem(() => studio.zoomTo(0.5))}
				>50%</button
			>
			<button type="button" role="menuitem" onclick={() => zoomItem(() => studio.zoomTo(1))}
				>100% <kbd>Ctrl 1</kbd></button
			>
			<button type="button" role="menuitem" onclick={() => zoomItem(() => studio.zoomTo(2))}
				>200%</button
			>
		</div>

		<button
			type="button"
			class="icon"
			popovertarget={downloadId}
			onmousedown={keep}
			aria-label="Download a picture"
			title="Download a picture"
		>
			<Icon name="download" size={17} />
		</button>
		<div
			id={downloadId}
			class="menu"
			popover="auto"
			role="menu"
			aria-label="Download"
			onbeforetoggle={(event) => placeBelow(event, downloadId, 'end')}
		>
			<button type="button" role="menuitem" disabled={downloading} onclick={() => download(1)}>
				PNG <span class="size">{studio.doc.width} × {studio.doc.height}</span>
			</button>
			{#if doubleFits}
				<button type="button" role="menuitem" disabled={downloading} onclick={() => download(2)}>
					PNG, twice the size <span class="size"
						>{studio.doc.width * 2} × {studio.doc.height * 2}</span
					>
				</button>
			{/if}
			<button type="button" role="menuitem" disabled={downloading} onclick={() => download(0.5)}>
				PNG, half the size <span class="size"
					>{Math.round(studio.doc.width / 2)} × {Math.round(studio.doc.height / 2)}</span
				>
			</button>
		</div>

		{#if $artUploadsOpen}
			<button
				type="button"
				class="save"
				disabled={saving}
				aria-busy={saving}
				onmousedown={keep}
				onclick={save}
				title={onShelf
					? 'Save it again in place of its copy on your art shelf, and every cover it’s on'
					: 'Save the picture to your art shelf, to put it on a book’s cover'}
			>
				<Icon name="image" size={16} />
				<span class="save-text">{saving ? 'Saving…' : 'Save to shelf'}</span>
			</button>
			<div id={savedId} class="menu saved" popover="auto" role="dialog" aria-label="Saved">
				<p class={['saved-note', { failed: !saved }]}>
					<Icon name={saved ? 'check-circle' : 'alert-circle'} size={16} />{savedNote}
				</p>
				{#if saved}
					{@const picture = saved}
					<button
						type="button"
						onclick={() => {
							document.getElementById(savedId)?.hidePopover();
							covering = picture;
						}}
					>
						Use it as a book’s cover…
					</button>
					<a href={resolve('/art')}>See your art shelf</a>
				{/if}
			</div>
		{/if}

		{#if narrow}
			<button
				type="button"
				class="icon"
				aria-pressed={sheet === 'properties'}
				aria-label="Properties"
				title="Properties"
				onmousedown={keep}
				onclick={() => onsheet?.(sheet === 'properties' ? null : 'properties')}
			>
				<Icon name="sliders" size={17} />
			</button>
			<button
				type="button"
				class="icon"
				aria-pressed={sheet === 'layers'}
				aria-label="Layers"
				title="Layers"
				onmousedown={keep}
				onclick={() => onsheet?.(sheet === 'layers' ? null : 'layers')}
			>
				<Icon name="layers" size={17} />
			</button>
		{/if}
		<span class="theme"><ThemeToggle /></span>
	</div>
</header>

{#if covering}
	<UseAsCover picture={covering} onclose={() => (covering = null)} />
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 52px;
		padding: 0 10px 0 8px;
		border-bottom: 1px solid var(--bb-line-faint);
		background: var(--studio-chrome);
		font-family: var(--font-ui);
	}

	.start,
	.end {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	.start {
		flex: 1;
		gap: 6px;
	}

	.back,
	.icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 38px;
		height: 38px;
		padding: 0;
		border: none;
		border-radius: 9px;
		background: none;
		color: var(--bb-text-label);
		text-decoration: none;
	}

	.back:hover,
	.icon:hover:not(:disabled) {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.icon:disabled {
		opacity: 0.35;
	}

	.icon[aria-pressed='true'] {
		background: color-mix(in srgb, var(--studio-accent) 18%, transparent);
		color: var(--bb-text-strong);
	}

	.title {
		min-width: 0;
		max-width: 320px;
		flex: 0 1 320px;
	}

	.title input {
		width: 100%;
		height: 34px;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: none;
		color: var(--bb-text-strong);
		font: 600 14.5px var(--font-ui);
		text-overflow: ellipsis;
	}

	.title input:hover {
		border-color: var(--bb-line-soft);
	}

	.title input:focus {
		border-color: var(--studio-accent);
		background: var(--bb-night);
		outline: none;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
		color: var(--bb-text-3);
		font-size: 12.5px;
		white-space: nowrap;
	}

	.status.failed {
		color: var(--bb-coral);
	}

	.status-text {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.surprise {
		display: inline-flex;
		flex: none;
		height: 36px;
		margin-right: 6px;
		border: 1px solid var(--bb-line-control);
		border-radius: 10px;
	}

	.roll,
	.roll-kind {
		display: inline-flex;
		align-items: center;
		border: none;
		background: none;
	}

	.roll {
		gap: 7px;
		padding: 0 10px 0 10px;
		border-radius: 9px 0 0 9px;
		color: var(--bb-text-strong);
		font: 600 13.5px var(--font-ui);
		white-space: nowrap;
	}

	.roll-kind {
		justify-content: center;
		width: 26px;
		padding: 0;
		border-left: 1px solid var(--bb-line-soft);
		border-radius: 0 9px 9px 0;
		color: var(--bb-text-label);
	}

	.roll:hover,
	.roll-kind:hover {
		background: var(--bb-hover);
	}

	.die {
		display: grid;
		color: var(--studio-accent);
		transition: transform 0.4s cubic-bezier(0.3, 1.4, 0.5, 1);
	}

	.kinds {
		width: 250px;
	}

	.menu-note {
		margin: 4px 8px 8px;
		color: var(--bb-text-3);
		font-size: 12px;
		line-height: 1.45;
	}

	.menu button[aria-checked='true'] {
		color: var(--bb-text-strong);
	}

	.zoom {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-width: 70px;
		height: 34px;
		padding: 0 8px 0 10px;
		border: none;
		border-radius: 8px;
		background: none;
		color: var(--bb-text-label);
		font: 600 13px var(--font-ui);
		font-variant-numeric: tabular-nums;
		justify-content: center;
	}

	.zoom:hover {
		background: var(--bb-hover);
	}

	.save {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 36px;
		margin-left: 4px;
		padding: 0 14px;
		border: none;
		border-radius: 10px;
		background: var(--bb-royal);
		color: #fff;
		font: 600 13.5px var(--font-ui);
	}

	.save:hover:not(:disabled) {
		filter: brightness(1.08);
	}

	.save:disabled {
		opacity: 0.7;
	}

	.saved {
		min-width: 260px;
		max-width: min(320px, calc(100vw - 16px));
	}

	.saved-note {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin: 0;
		padding: 8px 10px 10px;
		color: var(--bb-text-strong);
		font-size: 13.5px;
		font-weight: 600;
		line-height: 1.4;
	}

	.saved-note :global(svg) {
		flex: none;
		color: var(--bb-sky);
	}

	.saved-note.failed :global(svg) {
		color: var(--bb-coral);
	}

	.saved a {
		display: flex;
		align-items: center;
		min-height: 36px;
		padding: 0 10px;
		border-radius: 8px;
		color: var(--bb-text);
		font-size: 13.5px;
		text-decoration: none;
	}

	.saved a:hover {
		background: var(--bb-hover);
	}

	.menu {
		position: fixed;
		inset: auto;
		min-width: 220px;
		margin: 0;
		padding: 6px;
		border: 1px solid var(--bb-line-control);
		border-radius: 12px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font-family: var(--font-ui);
	}

	.menu button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		min-height: 36px;
		padding: 0 10px;
		border: none;
		border-radius: 8px;
		background: none;
		color: var(--bb-text-label);
		font: 500 13.5px var(--font-ui);
		text-align: left;
	}

	.menu button:hover:not(:disabled) {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.menu button:disabled {
		opacity: 0.45;
	}

	.menu hr {
		margin: 4px 6px;
		border: none;
		border-top: 1px solid var(--bb-line-faint);
	}

	kbd,
	.size {
		color: var(--bb-text-3);
		font: 500 11.5px var(--font-ui);
		font-variant-numeric: tabular-nums;
	}

	@media (prefers-reduced-motion: reduce) {
		.die {
			transition: none;
		}
	}

	@media (max-width: 900px) {
		.status-text {
			display: none;
		}
	}

	@media (max-width: 1100px) {
		.roll-text {
			display: none;
		}

		.roll {
			padding: 0 8px;
		}
	}

	@media (max-width: 600px) {
		.bar {
			gap: 2px;
			padding: 0 4px;
		}

		.save-text,
		.theme,
		.status,
		.zoom :global(svg) {
			display: none;
		}

		.back,
		.icon {
			width: 34px;
		}

		.save {
			width: 34px;
			margin-left: 2px;
			padding: 0;
			justify-content: center;
		}

		.zoom {
			min-width: 0;
			padding: 0 4px;
		}

		/* Tighter, so the drawing's name keeps room beside one more button. */
		.end {
			gap: 2px;
		}

		.back,
		.icon {
			width: 32px;
		}

		.surprise {
			height: 38px;
			margin-right: 0;
			border: none;
		}

		.roll-kind {
			display: none;
		}

		.roll {
			justify-content: center;
			width: 32px;
			padding: 0;
			border-radius: 9px;
		}
	}
</style>
