<script lang="ts">
	import { initials } from '$lib/library';

	// A round stand-in for a portrait: an entry's initials, in one of a few tones so a list of them
	// isn't a row of identical circles.
	let { name, id, size = 40 }: { name: string; id: number; size?: number } = $props();

	const TONES = ['paper', 'royal', 'raised'] as const;
</script>

<span
	class={['monogram', TONES[id % TONES.length]]}
	style:--size="{size}px"
	style:font-size="{Math.round(size * 0.38)}px"
	aria-hidden="true">{initials(name)}</span
>

<style>
	.monogram {
		flex: none;
		display: grid;
		place-items: center;
		width: var(--size);
		height: var(--size);
		border-radius: 50%;
		font-family: var(--font-display);
	}

	.paper {
		background: var(--bb-paper);
		box-shadow: inset 0 0 0 1px light-dark(rgba(60, 40, 10, 0.16), transparent);
		color: #141c45;
	}

	.royal {
		background: var(--bb-royal);
		color: #fff;
	}

	.raised {
		background: var(--bb-raised);
		box-shadow: inset 0 0 0 1px var(--bb-line-dashed);
		color: var(--bb-sky-text);
	}
</style>
