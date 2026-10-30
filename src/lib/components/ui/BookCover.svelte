<script lang="ts">
	// Pure-CSS cover generated from the title (books have no image field). The variant comes from
	// a stable hash of the id, so a book keeps its cover. Decorative: aria-hidden.
	let {
		id,
		title,
		author = '',
		size = 'md'
	}: { id: number; title: string; author?: string; size?: 'sm' | 'md' | 'lg' } = $props();

	function hash(text: string) {
		let h = 0;
		for (const char of text) h = (h * 31 + char.charCodeAt(0)) | 0;
		return Math.abs(h);
	}

	const variant = $derived(hash(String(id)) % 2 === 1 ? 'navy' : 'paper');

	const initials = $derived(
		title
			.split(/\s+/)
			.filter((word) => word && !/^(the|a|an|of)$/i.test(word))
			.slice(0, 2)
			.map((word) => word.charAt(0).toUpperCase())
			.join('') || title.charAt(0).toUpperCase()
	);

	// Long titles step down so they stay on the cover.
	const scale = $derived(title.length > 30 ? 0.7 : title.length > 16 ? 0.84 : 1);
</script>

<div class={['cover', size, variant]} aria-hidden="true" style:--title-scale={scale}>
	{#if size === 'sm'}
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

<style>
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

	.navy .over {
		color: var(--bb-sky-text);
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
			0 24px 40px -24px rgba(0, 0, 0, 0.95);
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
			0 40px 60px -30px rgba(0, 0, 0, 0.95),
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

	/* Paper */
	.paper {
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
			0 24px 40px -24px rgba(0, 0, 0, 0.95);
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
			0 40px 60px -30px rgba(0, 0, 0, 0.95);
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
		color: var(--bb-sky);
	}

	.paper.sm {
		background: linear-gradient(90deg, var(--bb-paper-line) 0 6px, var(--bb-paper) 6px);
		color: var(--bb-royal);
	}
</style>
