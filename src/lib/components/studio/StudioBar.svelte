<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';
	import { flatten } from '$lib/studio/render';
	import type { Studio } from '$lib/studio/studio.svelte';

	// The studio's top bar: back to the shelf, the drawing's name, whether it's kept, undo and redo,
	// the zoom, and downloading a picture. On small screens it also opens the panels.
	let {
		studio,
		title = $bindable(),
		status,
		narrow = false,
		sheet = null,
		onsheet
	}: {
		studio: Studio;
		title: string;
		status: 'kept' | 'keeping' | 'failed';
		narrow?: boolean;
		sheet?: 'properties' | 'layers' | null;
		onsheet?: (sheet: 'properties' | 'layers' | null) => void;
	} = $props();

	const zoomId = 'studio-zoom';
	const downloadId = 'studio-download';
	const keep = (event: MouseEvent) => event.preventDefault();
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
		<span class="status" class:failed={status === 'failed'} role="status">
			{#if status === 'kept'}<Icon name="check" size={13} />{/if}
			<span class="status-text">{STATUS[status]}</span>
		</span>
	</div>

	<div class="end">
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
			class="download"
			popovertarget={downloadId}
			onmousedown={keep}
			aria-label="Download a picture"
		>
			<Icon name="download" size={16} />
			<span class="download-text">Download</span>
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

	.download {
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

	.download:hover {
		filter: brightness(1.08);
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

	@media (max-width: 900px) {
		.status-text {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.bar {
			gap: 4px;
			padding: 0 6px 0 4px;
		}

		.download-text,
		.theme,
		.status,
		.zoom :global(svg) {
			display: none;
		}

		.back,
		.icon {
			width: 34px;
		}

		.download {
			width: 38px;
			padding: 0;
			justify-content: center;
		}

		.zoom {
			min-width: 0;
			padding: 0 6px;
		}
	}
</style>
