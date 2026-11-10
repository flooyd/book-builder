<script lang="ts">
	import type { CoverArt } from '$lib/art';
	import { coverTitleScale, coverVariant } from '$lib/cover';

	// A book's cover: the writer's own picture from the art shelf, or one drawn in CSS from the
	// title (see $lib/cover). Decorative (aria-hidden): the title is always written beside it.
	let {
		id,
		title,
		author = '',
		size = 'md',
		tilt = false,
		art = null
	}: {
		id: number;
		title: string;
		author?: string;
		size?: 'sm' | 'md' | 'lg';
		/** Tilt toward the pointer with a moving gloss, like a real book in the hand. */
		tilt?: boolean;
		/** A picture for the cover. If it can't be loaded, the drawn cover stands in. */
		art?: CoverArt | null;
	} = $props();

	let broken = $state<string | null>(null);
	const picture = $derived(art && broken !== art.smallUrl ? art.smallUrl : null);

	const variant = $derived(coverVariant(id));

	const initials = $derived(
		title
			.split(/\s+/)
			.filter((word) => word && !/^(the|a|an|of)$/i.test(word))
			.slice(0, 2)
			.map((word) => word.charAt(0).toUpperCase())
			.join('') || title.charAt(0).toUpperCase()
	);

	const scale = $derived(coverTitleScale(title));
</script>

{#if tilt}
	<motion-tilt class={['tilt', size]} max={size === 'lg' ? 9 : 12} scale={1.03} gloss={true}>
		{@render cover()}
	</motion-tilt>
{:else}
	{@render cover()}
{/if}

{#snippet cover()}
	<div
		class={['cover', size, picture ? 'pictured' : variant]}
		aria-hidden="true"
		style:--title-scale={scale}
	>
		{#if picture}
			<img
				src={picture}
				alt=""
				loading="lazy"
				decoding="async"
				onerror={() => (broken = picture)}
			/>
		{:else if size === 'sm'}
			<span class="mono">{initials}</span>
		{:else if variant === 'navy'}
			<span class="frame"></span>
			<span class="over">{author}</span>
			<span class="title">{title}</span>
			{#if size === 'lg'}
				<svg width="52" height="10" viewBox="0 0 52 10"
					><path d="M0 5h19M33 5h19" stroke="#7CB4FF" stroke-width="1" /><path
						d="M26 0l5 5-5 5-5-5z"
						fill="#7CB4FF"
					/></svg
				>
			{:else}
				<svg width="34" height="8" viewBox="0 0 34 8"
					><path d="M0 4h12M22 4h12" stroke="#7CB4FF" stroke-width="0.8" /><path
						d="M17 0l4 4-4 4-4-4z"
						fill="#7CB4FF"
					/></svg
				>
			{/if}
		{:else}
			<span class="emblem"><span></span></span>
			<span class="title">{title}</span>
			<span class="over">{author}</span>
		{/if}
	</div>
{/snippet}

<style>
	/* motion-tilt mirrors the host's radius onto its gloss, so match the cover's corners. */
	.tilt {
		flex: none;
	}

	/* In a stretching row (dashboard cards), keep the hover area the size of the cover. */
	.tilt.md {
		align-self: flex-start;
		border-radius: 3px 8px 8px 3px;
	}

	.tilt.lg {
		border-radius: 4px 12px 12px 4px;
	}

	.cover {
		position: relative;
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		box-sizing: border-box;
	}

	.title {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 5;
		line-clamp: 5;
		overflow: hidden;
		overflow-wrap: break-word;
		-webkit-hyphens: auto;
		hyphens: auto;
		font-family: var(--font-display);
		font-weight: 400;
	}

	.over {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 700;
		text-transform: uppercase;
	}

	svg {
		flex: none;
	}

	/* The writer's own picture, cut to the cover's shape, with the spine's shadow over it. */
	.pictured {
		overflow: hidden;
		background: #1d3184;
	}

	.pictured img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.pictured::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow:
			inset 8px 0 0 rgba(0, 0, 0, 0.22),
			inset 9px 0 0 rgba(255, 255, 255, 0.08),
			inset 0 0 0 1px rgba(0, 0, 0, 0.12);
		pointer-events: none;
	}

	.pictured.sm::after {
		box-shadow:
			inset 5px 0 0 rgba(0, 0, 0, 0.22),
			inset 0 0 0 1px rgba(0, 0, 0, 0.12);
	}

	.pictured.md {
		box-shadow: 0 24px 40px -24px var(--bb-drop);
	}

	.pictured.lg {
		box-shadow: 0 40px 60px -30px var(--bb-drop);
	}

	.pictured.lg::after {
		box-shadow:
			inset 10px 0 0 rgba(0, 0, 0, 0.22),
			inset 11px 0 0 rgba(255, 255, 255, 0.08),
			inset 0 0 0 1px rgba(0, 0, 0, 0.12);
	}

	/* Sizes */
	.sm {
		width: 48px;
		height: 64px;
		border-radius: 3px 6px 6px 3px;
		justify-content: center;
	}

	.md {
		width: 128px;
		height: 172px;
		border-radius: 3px 8px 8px 3px;
	}

	.lg {
		width: 196px;
		height: 264px;
		border-radius: 4px 12px 12px 4px;
	}

	/* Navy */
	.navy {
		background: #1d3184;
		justify-content: space-between;
	}

	.navy .title {
		color: #fff;
	}

	/* A cover is an object: its colors stay put when the theme changes. */
	.navy .over {
		color: #a9c8ff;
	}

	.frame {
		position: absolute;
		border: 1px solid rgba(124, 180, 255, 0.4);
		border-radius: 2px;
	}

	.navy.md {
		padding: 18px 10px 16px 16px;
		box-shadow:
			inset 8px 0 0 rgba(0, 0, 0, 0.25),
			0 24px 40px -24px var(--bb-drop);
	}

	.navy.md .frame {
		inset: 8px 8px 8px 16px;
	}

	.navy.md .over {
		font-size: 7px;
		letter-spacing: 0.3em;
	}

	.navy.md .title {
		font-size: calc(22px * var(--title-scale));
		line-height: 1;
	}

	.navy.lg {
		padding: 26px 16px 22px 26px;
		box-shadow:
			inset 10px 0 0 rgba(0, 0, 0, 0.25),
			0 40px 60px -30px var(--bb-drop),
			0 0 0 1px rgba(124, 180, 255, 0.25);
	}

	.navy.lg .frame {
		inset: 12px 12px 12px 24px;
		border-color: rgba(124, 180, 255, 0.45);
	}

	.navy.lg .over {
		font-size: 9px;
		letter-spacing: 0.32em;
	}

	.navy.lg .title {
		font-size: calc(34px * var(--title-scale));
		line-height: 0.98;
	}

	/* Paper; on the light theme's paper ground it needs an edge. */
	.paper {
		--paper-edge: light-dark(rgba(60, 40, 10, 0.14), transparent);
		background: var(--bb-paper);
		justify-content: center;
	}

	.paper .title {
		color: #141c45;
	}

	.paper .over {
		color: var(--bb-royal);
	}

	.emblem {
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: 1.5px solid var(--bb-royal);
	}

	.emblem span {
		border-radius: 50%;
		background: var(--bb-royal);
	}

	.paper.md {
		gap: 12px;
		padding: 16px 10px 16px 16px;
		box-shadow:
			inset 8px 0 0 rgba(60, 40, 10, 0.14),
			inset 0 0 0 1px var(--paper-edge),
			0 24px 40px -24px var(--bb-drop);
	}

	.paper.md .emblem {
		width: 34px;
		height: 34px;
	}

	.paper.md .emblem span {
		width: 14px;
		height: 14px;
	}

	.paper.md .title {
		font-size: calc(23px * var(--title-scale));
		line-height: 1;
	}

	.paper.md .over {
		font-size: 7px;
		letter-spacing: 0.3em;
	}

	.paper.lg {
		gap: 18px;
		padding: 26px 16px 22px 26px;
		box-shadow:
			inset 10px 0 0 rgba(60, 40, 10, 0.14),
			inset 0 0 0 1px var(--paper-edge),
			0 40px 60px -30px var(--bb-drop);
	}

	.paper.lg .emblem {
		width: 52px;
		height: 52px;
		border-width: 2px;
	}

	.paper.lg .emblem span {
		width: 21px;
		height: 21px;
	}

	.paper.lg .title {
		font-size: calc(34px * var(--title-scale));
		line-height: 0.98;
	}

	.paper.lg .over {
		font-size: 9px;
		letter-spacing: 0.32em;
	}

	/* Small monogram covers */
	.mono {
		font-family: var(--font-display);
		font-size: 16px;
	}

	.navy.sm {
		background: linear-gradient(90deg, #0c1748 0 6px, #1d3184 6px);
		box-shadow: inset 0 0 0 1px rgba(124, 180, 255, 0.4);
		color: #7cb4ff;
	}

	.paper.sm {
		background: linear-gradient(90deg, var(--bb-paper-line) 0 6px, var(--bb-paper) 6px);
		box-shadow: inset 0 0 0 1px var(--paper-edge);
		color: var(--bb-royal);
	}
</style>
