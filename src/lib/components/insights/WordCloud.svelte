<script lang="ts">
	import { onMount } from 'svelte';
	import { layOutCloud, nextWord, wordNear, type CloudWord, type Direction } from '$lib/word-cloud';
	import ChartTip from './ChartTip.svelte';

	// The words of a map, biggest in the middle, sized by how often they're used. Sizes come from
	// measuring the real fonts, so it's laid out in the browser, once they've loaded. It's drawn in
	// proportion to its own width, so it scales as a window is resized and only sets the words out
	// afresh every so often.
	let {
		words,
		selected,
		onselect,
		label
	}: {
		/** Heaviest first. A `tip` says what a word's count means, `name` marks one of the story's. */
		words: (CloudWord & { tip: string; name: boolean })[];
		/** The key of the open word. */
		selected: string | null;
		onselect: (key: string) => void;
		/** Says what the cloud shows, for screen readers. */
		label: string;
	} = $props();

	/** Display type carries the big words, and reading type stays clear at the small end. */
	const DISPLAY_FROM = 24;
	/** A small word's reach for a finger, so a tap beside it still lands. */
	const TAP_REACH = 22;
	/** Lays out afresh at each of these steps of width. In between the words only grow to fit. */
	const WIDTH_STEP = 60;

	const ARROWS: Record<string, Direction> = {
		ArrowLeft: 'left',
		ArrowRight: 'right',
		ArrowUp: 'up',
		ArrowDown: 'down'
	};

	let width = $state(0);
	let box = $state<HTMLElement>();
	let context = $state<CanvasRenderingContext2D | null>(null);
	let display = $state('serif');
	let read = $state('serif');
	/** The word Tab lands on, kept when the arrows move on from it. */
	let current = $state<string | null>(null);
	let tipped = $state<string | null>(null);

	const familyAt = (size: number) => (size >= DISPLAY_FROM ? display : read);
	const room = $derived(Math.floor(width / WIDTH_STEP) * WIDTH_STEP);

	onMount(() => {
		let gone = false;
		const styles = getComputedStyle(document.documentElement);
		const [displayFont, readFont] = ['--font-display', '--font-read'].map((token) =>
			styles.getPropertyValue(token).trim()
		);
		// Measuring before a font arrives would set every word out for the wrong shape of letters. If
		// one never comes, the fallback is what shows and what's measured.
		Promise.allSettled([
			document.fonts.load(`40px ${displayFont}`),
			document.fonts.load(`16px ${readFont}`)
		]).then(() => {
			if (gone) return;
			display = displayFont;
			read = readFont;
			context = document.createElement('canvas').getContext('2d');
		});
		return () => (gone = true);
	});

	function measure(text: string, size: number) {
		if (!context) return 0;
		context.font = `${size}px ${familyAt(size)}`;
		return context.measureText(text).width;
	}

	const cloud = $derived(context && room > 0 ? layOutCloud(words, room, measure) : null);
	const tabStop = $derived(
		cloud?.words.some((word) => word.key === current) ? current : cloud?.words[0]?.key
	);
	const tipWord = $derived(cloud?.words.find((word) => word.key === tipped));
	const scale = $derived(cloud ? width / cloud.width : 1);

	const keyOf = (target: EventTarget | null) =>
		(target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key ?? null;

	function keydown(event: KeyboardEvent) {
		if (!cloud) return;
		let next: string | undefined;
		const index = cloud.words.findIndex((word) => word.key === keyOf(event.target));
		if (event.key === 'Home') next = cloud.words[0].key;
		else if (event.key === 'End') next = cloud.words[cloud.words.length - 1].key;
		else if (event.key in ARROWS) next = nextWord(cloud.words, index, ARROWS[event.key])?.key;
		else return;

		event.preventDefault();
		if (!next) return;
		current = next;
		box?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next)}"]`)?.focus();
	}

	/** A tap in the gap beside a small word. Keyboards have the words themselves. */
	function reach(event: MouseEvent) {
		if (!cloud || !box || keyOf(event.target)) return;
		const area = box.getBoundingClientRect();
		const x = (event.clientX - area.left) / scale;
		const y = (event.clientY - area.top) / scale;
		const near = wordNear(cloud.words, x, y, TAP_REACH / scale, measure);
		if (near) onselect(near.key);
	}
</script>

<!-- The arrow keys move between the words inside, and the click only widens their reach for a finger. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<ul
	class="cloud"
	class:ready={cloud}
	aria-label={label}
	bind:this={box}
	bind:clientWidth={width}
	style:aspect-ratio={cloud && cloud.height > 0 ? `${cloud.width} / ${cloud.height}` : undefined}
	onkeydown={keydown}
	onclick={reach}
	onpointerover={(event) => {
		if (event.pointerType === 'mouse') tipped = keyOf(event.target);
	}}
	onpointerleave={() => (tipped = null)}
	onfocusin={(event) => {
		current = keyOf(event.target);
		// Not after a tap: the open word already says it all, and a tip would sit on its neighbours.
		if ((event.target as HTMLElement).matches(':focus-visible')) tipped = current;
	}}
	onfocusout={() => (tipped = null)}
>
	{#if cloud}
		{#each cloud.words as word (word.key)}
			<li
				style:left="{(word.x / cloud.width) * 100}%"
				style:top="{(word.y / cloud.height) * 100}%"
				style:font-size="{(word.size / cloud.width) * 100}cqw"
				style:font-family={familyAt(word.size)}
			>
				<button
					type="button"
					class:name={word.name}
					class:small={word.size < DISPLAY_FROM}
					data-key={word.key}
					tabindex={word.key === tabStop ? 0 : -1}
					aria-pressed={word.key === selected}
					aria-label="{word.text}, {word.tip}"
					onclick={() => onselect(word.key)}
				>
					{word.text}
				</button>
			</li>
		{/each}
		{#if tipWord}
			<ChartTip
				x={tipWord.x * scale}
				top={tipWord.y * scale - (tipWord.size * scale) / 2}
				bounds={width}
				value={tipWord.text}
				label={tipWord.tip}
			/>
		{/if}
	{/if}
</ul>

<style>
	/* Holds the space from the first paint, so nothing jumps when the words arrive. */
	.cloud {
		position: relative;
		container-type: inline-size;
		aspect-ratio: 1.8;
		margin: 0;
		padding: 0;
		list-style: none;
		opacity: 0;
		transition: opacity 240ms ease;
	}

	.cloud.ready {
		opacity: 1;
	}

	li {
		position: absolute;
		transform: translate(-50%, -50%);
		line-height: 1;
		white-space: nowrap;
	}

	button {
		display: block;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--bb-text-strong);
		font: inherit;
		line-height: 1;
		white-space: nowrap;
		cursor: pointer;
	}

	button.small {
		color: var(--bb-text-2);
	}

	button.name {
		color: var(--bb-sky);
	}

	button:hover {
		text-decoration: underline;
		text-decoration-thickness: 0.06em;
		text-underline-offset: 0.12em;
	}

	button[aria-pressed='true'] {
		background: var(--mark-yellow);
		box-shadow: 0 0 0 2px var(--mark-yellow);
		color: var(--bb-text-strong);
	}

	@media (prefers-reduced-motion: reduce) {
		.cloud {
			transition: none;
		}
	}
</style>
