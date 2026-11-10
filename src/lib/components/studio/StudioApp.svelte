<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { readDraft, writeDraft, writePixels, type DraftInfo } from '$lib/studio/draft';
	import { thumbnail } from '$lib/studio/render';
	import { Studio, type ToolId } from '$lib/studio/studio.svelte';
	import { makeTools, toolForKey } from '$lib/studio/tools';
	import type { Tool } from '$lib/studio/tools/tool';
	import Inspector from './Inspector.svelte';
	import LayersPanel from './LayersPanel.svelte';
	import Stage from './Stage.svelte';
	import StudioBar from './StudioBar.svelte';
	import ToolRail from './ToolRail.svelte';

	// The art studio: one drawing, opened from this browser's drafts. On a wide screen the tools
	// are down the left and the properties and layers down the right; on a small one the tools are
	// a strip along the bottom and the panels open as sheets. Every change is kept in this browser
	// a moment after it's made (see $lib/studio/draft), with a small picture for the shelf.
	let { draftKey, owner }: { draftKey: string; owner: string } = $props();

	let phase = $state<'loading' | 'missing' | 'ready'>('loading');
	let studio = $state.raw<Studio | null>(null);
	let tools = $state.raw<Record<ToolId, Tool> | null>(null);
	let info = $state.raw<DraftInfo | null>(null);
	let title = $state('');
	let stage = $state<ReturnType<typeof Stage>>();

	let width = $state(1440);
	const narrow = $derived(width <= 900);
	let sheet = $state<'properties' | 'layers' | null>(null);

	onMount(() => {
		let gone = false;
		(async () => {
			const found = await readDraft(draftKey, owner).catch(() => null);
			if (gone) return;
			if (!found) {
				phase = 'missing';
				return;
			}
			const next = new Studio(found.doc);
			// Paint layers' pixels, back on canvases of the drawing's size.
			for (const [layerId, blob] of found.pixels) {
				if (!found.doc.layers.some((layer) => layer.id === layerId && layer.kind === 'paint'))
					continue;
				try {
					const bitmap = await createImageBitmap(blob);
					const canvas = next.ensurePaint(layerId);
					canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
					bitmap.close();
				} catch {
					// A picture the browser can't read leaves the layer empty rather than the drawing shut.
				}
			}
			for (const layer of found.doc.layers) if (layer.kind === 'paint') next.ensurePaint(layer.id);
			info = found.info;
			title = found.info.title;
			keptTitle = title;
			studio = next;
			tools = makeTools(next);
			phase = 'ready';
		})();
		return () => {
			gone = true;
		};
	});

	// ---- Keeping the draft ---------------------------------------------------------------------------

	let status = $state<'kept' | 'keeping' | 'failed'>('kept');
	let timer: ReturnType<typeof setTimeout> | null = null;
	let keptRevision = 0;
	let keptPaint = 0;
	let keptTitle = '';
	let running: Promise<void> | null = null;

	$effect(() => {
		if (!studio) return;
		void [studio.revision, studio.paintTick, title];
		untrack(() => {
			if (
				studio &&
				(studio.revision !== keptRevision || studio.paintTick !== keptPaint || title !== keptTitle)
			) {
				schedule();
			}
		});
	});

	function schedule() {
		status = 'keeping';
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void keep(), 700);
	}

	const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
		new Promise<Blob | null>((done) => canvas.toBlob(done, type, quality));

	async function keep() {
		if (timer) clearTimeout(timer);
		timer = null;
		if (running) await running;
		if (!studio || !info) return;
		const now = studio;
		const base = info;
		const doc = now.doc;
		const revision = now.revision;
		const paintTick = now.paintTick;
		const named = title;
		running = (async () => {
			try {
				const thumb = await toBlob(thumbnail({ doc, paint: now.paint }), 'image/webp', 0.86);
				const next: DraftInfo = {
					...base,
					title: named.trim(),
					width: doc.width,
					height: doc.height,
					updatedAt: Date.now(),
					thumb
				};
				await writeDraft(next, doc);
				if (paintTick !== keptPaint) {
					const paintIds = doc.layers
						.filter((layer) => layer.kind === 'paint')
						.map((layer) => layer.id);
					const changed: [string, Blob][] = [];
					for (const id of paintIds) {
						const canvas = now.paint.get(id);
						const blob = canvas ? await toBlob(canvas, 'image/png') : null;
						if (blob) changed.push([id, blob]);
					}
					await writePixels(draftKey, changed, paintIds);
				}
				info = next;
				keptRevision = revision;
				keptPaint = paintTick;
				keptTitle = named;
				const caughtUp =
					now.revision === revision && now.paintTick === paintTick && title === named;
				status = caughtUp ? 'kept' : 'keeping';
			} catch {
				status = 'failed';
			}
		})();
		await running;
		running = null;
		if (status === 'keeping') schedule();
	}

	beforeNavigate(() => {
		if (timer) void keep();
	});

	onMount(() => {
		const hide = () => {
			if (document.visibilityState === 'hidden' && timer) void keep();
		};
		document.addEventListener('visibilitychange', hide);
		return () => document.removeEventListener('visibilitychange', hide);
	});

	// ---- Tools and keys --------------------------------------------------------------------------------

	function choose(id: ToolId) {
		if (!studio || !tools) return;
		if (id !== studio.toolId) tools[studio.toolId].leave?.();
		studio.toolId = id;
		studio.hoverId = null;
		if (narrow) sheet = null;
	}

	const MODIFIERS = ['Shift', 'Alt', 'Control', 'Meta'];

	function keydown(event: KeyboardEvent) {
		if (!studio || !tools) return;
		const target = event.target as HTMLElement | null;
		// Typing in a field, or in a menu or a picker, keeps its keys.
		if (target?.closest('input, textarea, select, [contenteditable="true"], [popover], dialog'))
			return;
		const tool = tools[studio.tool];
		if (MODIFIERS.includes(event.key)) {
			stage?.modifiers(event);
			if (event.key === 'Alt') event.preventDefault();
			return;
		}
		if (event.key === ' ') {
			if (target?.closest('button, a')) return;
			event.preventDefault();
			if (!event.repeat && !studio.heldTool && !stage?.busy()) studio.heldTool = 'hand';
			return;
		}
		if (stage?.busy() && event.key !== 'Escape') return;
		if (tool.key?.(event)) {
			event.preventDefault();
			return;
		}
		const mod = event.ctrlKey || event.metaKey;
		if (mod) {
			if (!shortcut(event)) return;
			event.preventDefault();
			return;
		}
		if (event.altKey) return;
		const step = event.shiftKey ? 10 : 1;
		switch (event.key) {
			case 'Escape':
				if (!tool.cancel()) {
					if (studio.selection.length) studio.select([]);
					else if (studio.toolId !== 'select') choose('select');
				}
				break;
			case 'Enter':
				if (!tool.finish?.()) return;
				break;
			case 'Delete':
			case 'Backspace':
				studio.deleteSelection();
				break;
			case 'ArrowLeft':
				studio.nudge(-step, 0);
				break;
			case 'ArrowRight':
				studio.nudge(step, 0);
				break;
			case 'ArrowUp':
				studio.nudge(0, -step);
				break;
			case 'ArrowDown':
				studio.nudge(0, step);
				break;
			default: {
				const key = event.key.toLowerCase();
				if (event.shiftKey && key === 'h') studio.flip(true);
				else if (event.shiftKey && key === 'v') studio.flip(false);
				else if (!event.shiftKey && key === 'x') swapColours();
				else if (!event.shiftKey && key === 'd') {
					studio.style.fill = '#e8b04bff';
					studio.style.stroke = '#1d2142ff';
					studio.style.strokeWidth = 4;
				} else {
					const id = toolForKey(event.key, event.shiftKey);
					if (!id) return;
					choose(id);
				}
			}
		}
		event.preventDefault();
	}

	/** Ctrl or Cmd with a key. Returns whether it was one of the studio's. */
	function shortcut(event: KeyboardEvent) {
		if (!studio) return false;
		const key = event.key.toLowerCase();
		switch (event.code) {
			case 'BracketRight':
				studio.arrange(event.shiftKey ? 'front' : 'forward');
				return true;
			case 'BracketLeft':
				studio.arrange(event.shiftKey ? 'back' : 'backward');
				return true;
			case 'Digit0':
			case 'Numpad0':
				studio.fit();
				return true;
			case 'Digit1':
			case 'Numpad1':
				studio.zoomTo(1);
				return true;
			case 'Digit2':
			case 'Numpad2':
				if (studio.selectionBounds) studio.fit(studio.selectionBounds);
				return true;
			case 'Equal':
			case 'NumpadAdd':
				studio.zoomStep(1);
				return true;
			case 'Minus':
			case 'NumpadSubtract':
				studio.zoomStep(-1);
				return true;
		}
		switch (key) {
			case 'z':
				if (event.shiftKey) studio.redo();
				else studio.undo();
				return true;
			case 'y':
				studio.redo();
				return true;
			case 'd':
				studio.duplicateSelection();
				return true;
			case 'g':
				if (event.shiftKey) studio.ungroup();
				else studio.group();
				return true;
			case 'c':
				studio.copy();
				return true;
			case 'x':
				studio.cut();
				return true;
			case 'v':
				studio.paste();
				return true;
			case 'a':
				studio.selectAll();
				return true;
			case 's':
				void keep();
				return true;
		}
		return false;
	}

	function keyup(event: KeyboardEvent) {
		if (!studio) return;
		// A drag the hand began carries on to its end (the stage keeps the tool that took the press).
		if (event.key === ' ' && studio.heldTool === 'hand') studio.heldTool = null;
		if (MODIFIERS.includes(event.key)) stage?.modifiers(event);
	}

	function swapColours() {
		if (!studio) return;
		const first = studio.selected[0]?.shape;
		const fill =
			first && first.kind !== 'group' && first.kind !== 'line'
				? (first.fill?.color ?? null)
				: studio.style.fill;
		const stroke =
			first && first.kind !== 'group' ? (first.stroke?.paint.color ?? null) : studio.style.stroke;
		studio.setFill(stroke);
		studio.setStroke(fill);
	}

	function blur() {
		if (studio?.heldTool) studio.heldTool = null;
	}
</script>

<svelte:window bind:innerWidth={width} onkeydown={keydown} onkeyup={keyup} onblur={blur} />

<svelte:head>
	<title>{title.trim() || 'Untitled drawing'} · Studio · Book Builder</title>
</svelte:head>

<div class="studio" class:narrow>
	{#if phase === 'ready' && studio && tools}
		<div class="bar-area">
			<StudioBar
				{studio}
				{draftKey}
				bind:title
				{status}
				{narrow}
				{sheet}
				onsheet={(next) => (sheet = next)}
			/>
		</div>
		{#if !narrow}
			<aside class="rail-area" aria-label="Tools">
				<ToolRail {studio} {choose} />
			</aside>
		{/if}
		<main class="stage-area">
			<Stage bind:this={stage} {studio} {tools} />
			{#if narrow}
				<div class="strip">
					<ToolRail {studio} {choose} across />
				</div>
			{/if}
		</main>
		{#if !narrow}
			<aside class="panels" aria-label="Properties and layers">
				<div class="properties"><Inspector {studio} side="left" /></div>
				<div class="layers"><LayersPanel {studio} /></div>
			</aside>
		{:else if sheet}
			<div
				class="sheet"
				role="dialog"
				aria-label={sheet === 'properties' ? 'Properties' : 'Layers'}
			>
				<div class="sheet-head">
					<span class="sheet-title">{sheet === 'properties' ? 'Properties' : 'Layers'}</span>
					<button type="button" class="close" aria-label="Close" onclick={() => (sheet = null)}>
						<Icon name="x" size={18} />
					</button>
				</div>
				<div class="sheet-body">
					{#if sheet === 'properties'}
						<Inspector {studio} side="above" />
					{:else}
						<LayersPanel {studio} heading={false} />
					{/if}
				</div>
			</div>
		{/if}
	{:else if phase === 'missing'}
		<div class="message">
			<h1>This drawing isn’t in this browser</h1>
			<p>
				Drawings are kept in the browser they were made in. It may be on another device, or the
				browser’s storage may have been cleared.
			</p>
			<a class="link" href={resolve('/studio')}
				><Icon name="arrow-left" size={16} /> Back to your drawings</a
			>
		</div>
	{:else}
		<div class="message" aria-busy="true">
			<p>Opening the drawing…</p>
		</div>
	{/if}
</div>

<style>
	.studio {
		--studio-accent: #2f6bff;
		--studio-desk: light-dark(#e4dfd4, #060a1a);
		--studio-chrome: light-dark(#f8f4ec, #0d1330);
		--studio-field: light-dark(rgba(20, 28, 69, 0.06), rgba(255, 255, 255, 0.06));
		--studio-shadow: light-dark(rgba(60, 45, 20, 0.28), rgba(0, 0, 0, 0.65));

		position: fixed;
		inset: 0;
		display: grid;
		grid-template:
			'bar bar bar' auto
			'rail stage panels' minmax(0, 1fr)
			/ 56px minmax(0, 1fr) 280px;
		background: var(--studio-chrome);
		color: var(--bb-text);
		font-family: var(--font-ui);
		overflow: hidden;
	}

	.studio.narrow {
		grid-template:
			'bar' auto
			'stage' minmax(0, 1fr)
			/ minmax(0, 1fr);
	}

	.bar-area {
		grid-area: bar;
		min-width: 0;
	}

	.rail-area {
		grid-area: rail;
		border-right: 1px solid var(--bb-line-faint);
		background: var(--studio-chrome);
	}

	.stage-area {
		grid-area: stage;
		position: relative;
		min-width: 0;
		min-height: 0;
	}

	.panels {
		grid-area: panels;
		display: grid;
		grid-template-rows: minmax(0, 1fr) minmax(200px, 42%);
		min-height: 0;
		border-left: 1px solid var(--bb-line-faint);
		background: var(--studio-chrome);
	}

	.properties {
		min-height: 0;
		overflow: auto;
	}

	.layers {
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-top: 1px solid var(--bb-line-soft);
	}

	.layers :global(.layers) {
		flex: 1;
	}

	/* The tools along the bottom of a small screen, floating over the drawing. */
	.strip {
		position: absolute;
		left: 50%;
		bottom: max(12px, env(safe-area-inset-bottom));
		max-width: calc(100% - 16px);
		overflow-x: auto;
		border: 1px solid var(--bb-line-soft);
		border-radius: 16px;
		background: var(--studio-chrome);
		box-shadow: 0 16px 40px -18px var(--bb-drop);
		transform: translateX(-50%);
		scrollbar-width: none;
	}

	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 5;
		display: flex;
		flex-direction: column;
		max-height: 62dvh;
		border-top: 1px solid var(--bb-line-soft);
		border-radius: 18px 18px 0 0;
		background: var(--studio-chrome);
		box-shadow: 0 -20px 50px -24px var(--bb-drop);
	}

	.sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 8px 0 18px;
	}

	.sheet-title {
		color: var(--bb-text-strong);
		font-size: 14px;
		font-weight: 700;
	}

	.close {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--bb-text-label);
	}

	.sheet-body {
		min-height: 0;
		overflow: auto;
		padding-bottom: env(safe-area-inset-bottom);
	}

	.message {
		grid-column: 1 / -1;
		grid-row: 1 / -1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 24px;
		text-align: center;
		color: var(--bb-text-2);
	}

	.message h1 {
		margin: 0;
		color: var(--bb-text-strong);
		font: 400 28px var(--font-display);
	}

	.message p {
		max-width: 460px;
		margin: 0;
		line-height: 1.55;
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		color: var(--bb-sky);
		font-weight: 600;
		text-decoration: none;
	}
</style>
