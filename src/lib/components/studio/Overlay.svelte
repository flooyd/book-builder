<script lang="ts">
	import type { Point } from '$lib/studio/geometry';
	import type { Chrome } from '$lib/studio/tools/tool';

	// The tool's marks over the drawing, in screen pixels so they stay the same size at any zoom:
	// outlines, the selection's box and handles, a path's points and their handles, the box being
	// dragged out, and a measurement by the pointer. Nothing here takes the pointer.
	let { chrome }: { chrome: Chrome } = $props();

	const SIZE = 8;

	const box = $derived.by(() => {
		const frame = chrome.box;
		if (!frame) return null;
		const [a, b, c, d] = frame.corners;
		const width = Math.hypot(b.x - a.x, b.y - a.y);
		const height = Math.hypot(d.x - a.x, d.y - a.y);
		const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
		const middle = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
		const all = [a, middle(a, b), b, middle(b, c), c, middle(c, d), d, middle(d, a)];
		// The same handles the select tool answers to.
		const small = Math.min(width, height) < 24;
		const handles = frame.handles
			? all.filter((_, index) => {
					if (index % 2 === 0) return true;
					if (small) return false;
					if (width < 1 && (index === 1 || index === 5)) return false;
					if (height < 1 && (index === 3 || index === 7)) return false;
					return true;
				})
			: [];
		return {
			points: frame.corners.map((point) => `${point.x},${point.y}`).join(' '),
			handles,
			angle
		};
	});
</script>

<svg class="overlay" aria-hidden="true">
	{#each chrome.paths as path, index (index)}
		<path class="outline {path.kind}" d={path.d} />
	{/each}

	{#if box}
		<polygon class="box" points={box.points} />
		{#each box.handles as handle, index (index)}
			<rect
				class="grip"
				x={handle.x - SIZE / 2}
				y={handle.y - SIZE / 2}
				width={SIZE}
				height={SIZE}
				rx="1.5"
				transform="rotate({box.angle} {handle.x} {handle.y})"
			/>
		{/each}
	{/if}

	{#each chrome.handles as handle, index (index)}
		<line class="arm" x1={handle.ax} y1={handle.ay} x2={handle.x} y2={handle.y} />
		<circle class="knob" cx={handle.x} cy={handle.y} r="3.75" />
	{/each}

	{#each chrome.anchors as anchor, index (index)}
		{#if anchor.first}
			<circle class="first" cx={anchor.x} cy={anchor.y} r="6.5" />
		{/if}
		<rect
			class="anchor"
			class:on={anchor.selected}
			x={anchor.x - 3.75}
			y={anchor.y - 3.75}
			width="7.5"
			height="7.5"
		/>
	{/each}

	{#if chrome.marquee}
		<rect
			class="marquee"
			x={chrome.marquee.x + 0.5}
			y={chrome.marquee.y + 0.5}
			width={chrome.marquee.width}
			height={chrome.marquee.height}
		/>
	{/if}
</svg>

{#if chrome.label}
	<span class="label" style:left="{chrome.label.x}px" style:top="{chrome.label.y}px"
		>{chrome.label.text}</span
	>
{/if}

<style>
	.overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}

	.outline {
		fill: none;
		stroke: var(--studio-accent);
		stroke-width: 1.25;
	}

	.outline.hover {
		stroke-width: 2;
	}

	.outline.guide {
		stroke-dasharray: 4 3;
		opacity: 0.8;
	}

	.outline.preview {
		stroke-width: 1.5;
	}

	.box {
		fill: none;
		stroke: var(--studio-accent);
		stroke-width: 1;
	}

	.grip {
		fill: #fff;
		stroke: var(--studio-accent);
		stroke-width: 1.25;
	}

	.arm {
		stroke: var(--studio-accent);
		stroke-width: 1;
	}

	.knob {
		fill: #fff;
		stroke: var(--studio-accent);
		stroke-width: 1.25;
	}

	.anchor {
		fill: #fff;
		stroke: var(--studio-accent);
		stroke-width: 1.25;
	}

	.anchor.on {
		fill: var(--studio-accent);
	}

	.first {
		fill: none;
		stroke: var(--studio-accent);
		stroke-width: 1.5;
	}

	.marquee {
		fill: color-mix(in srgb, var(--studio-accent) 9%, transparent);
		stroke: var(--studio-accent);
		stroke-width: 1;
	}

	.label {
		position: absolute;
		transform: translate(14px, 16px);
		padding: 3px 7px;
		border-radius: 6px;
		background: var(--studio-accent);
		color: #fff;
		font: 600 11.5px var(--font-ui);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		pointer-events: none;
	}
</style>
