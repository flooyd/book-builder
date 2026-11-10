<script lang="ts">
	import { untrack } from 'svelte';
	import { locate } from '$lib/studio/edit';
	import { multiply } from '$lib/studio/geometry';
	import type { Studio, Typing } from '$lib/studio/studio.svelte';
	import { fontOf, layoutText } from '$lib/studio/text';

	// Where text is typed: a textarea laid over the text on the stage, turned and zoomed with it.
	// Its own letters are clear, so what shows is the drawing's text, drawn as it will be saved, and
	// the textarea gives the caret, the selection, the keys and the ways of typing other letters (a
	// phone's keyboard, accents, other scripts). Esc, Ctrl+Enter or a click away finishes.
	let { studio }: { studio: Studio } = $props();

	let area = $state<HTMLTextAreaElement>();

	const placed = $derived.by(() => {
		const typing = studio.typing;
		if (!typing) return null;
		const found = locate(studio.doc, typing.id);
		if (!found || found.shape.kind !== 'text') return null;
		const shape = found.shape;
		const layout = layoutText(shape);
		const m = multiply(studio.viewMatrix(), multiply(found.matrix, shape.transform));
		// The zoom goes into the sizes rather than the transform, so the caret stays a screen pixel
		// wide at any zoom; the transform keeps only the turn (and a mirror) and the place.
		const zoom = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
		const px = (value: number) => `${value * zoom}px`;
		// Room past either end of the line for the caret, outside the text's own box.
		const pad = layout.lineHeight;
		return {
			shape,
			font: fontOf({ ...shape, size: shape.size * zoom }),
			lineHeight: px(layout.lineHeight),
			spacing: px(layout.spacing),
			width: px(layout.width + pad * 2),
			height: px(layout.height),
			padding: `0 ${px(pad)}`,
			transform: `matrix(${[m[0] / zoom, m[1] / zoom, m[2] / zoom, m[3] / zoom, m[4], m[5]].join(',')}) translateX(-${px(pad)})`
		};
	});

	let started: Typing | null = null;

	/**
	 * Puts the keyboard in the box. The stage calls this straight from the press, so a phone shows
	 * its keyboard (it only does for focus given during a touch).
	 */
	export function focus() {
		const typing = studio.typing;
		if (!area || !typing || !placed) return;
		if (started !== typing) {
			started = typing;
			area.value = placed.shape.text;
			const caret = typing.caret === 'all' ? 0 : Math.min(typing.caret, area.value.length);
			area.setSelectionRange(caret, typing.caret === 'all' ? area.value.length : caret);
		}
		area.focus({ preventScroll: true });
	}

	$effect(() => {
		if (studio.typing && area) untrack(focus);
	});

	function finish() {
		studio.endTyping();
		studio.toolId = 'select';
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
			event.preventDefault();
			finish();
		}
	}
</script>

{#if placed}
	<textarea
		bind:this={area}
		class="typing"
		aria-label="Text"
		spellcheck="false"
		autocomplete="off"
		wrap="off"
		style:font={placed.font}
		style:line-height={placed.lineHeight}
		style:letter-spacing={placed.spacing}
		style:text-align={placed.shape.align}
		style:width={placed.width}
		style:height={placed.height}
		style:padding={placed.padding}
		style:transform={placed.transform}
		oninput={(event) => studio.type(event.currentTarget.value)}
		onkeydown={keydown}
		onblur={() => studio.endTyping()}
		onpointerdown={(event) => event.stopPropagation()}
		ondblclick={(event) => event.stopPropagation()}></textarea>
{/if}

<style>
	.typing {
		position: absolute;
		top: 0;
		left: 0;
		box-sizing: border-box;
		margin: 0;
		border: none;
		border-radius: 0;
		/* Not the app's focus ring: the outline the tool draws round the text says where it is. */
		outline: none;
		box-shadow: none;
		overflow: hidden;
		resize: none;
		background: transparent;
		/* The drawing shows the letters; this box shows only the caret and what's picked. */
		color: transparent;
		caret-color: var(--studio-accent);
		white-space: pre;
		transform-origin: 0 0;
		user-select: text;
		-webkit-user-select: text;
		touch-action: manipulation;
	}

	.typing::selection {
		background: color-mix(in srgb, var(--studio-accent) 32%, transparent);
	}
</style>
