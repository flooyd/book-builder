<script lang="ts">
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';

	// A picture of the art studio for the home page: the real window (bar, tools, properties and
	// layers) with a cover for The Glass Armada on the artboard, drawn only with what the studio
	// really has: solid fills, strokes, opacity, ellipses, stars and pen paths. The big sail is
	// selected, as the select tool shows it. Decorative; the section's words say what it is.

	const tools: { icon: IconName; on?: boolean }[] = [
		{ icon: 'cursor', on: true },
		{ icon: 'points' },
		{ icon: 'pen-nib' },
		{ icon: 'pencil' },
		{ icon: 'star' },
		{ icon: 'hand' },
		{ icon: 'search' }
	];

	// Stars over the sea: [x, y, radius, opacity].
	const dots: [number, number, number, number][] = [
		[22, 30, 1.4, 0.8],
		[58, 66, 1, 0.6],
		[96, 22, 1.6, 0.9],
		[128, 84, 1, 0.5],
		[30, 132, 1.2, 0.7],
		[262, 40, 1.3, 0.8],
		[284, 178, 1, 0.6],
		[244, 214, 1.4, 0.7],
		[16, 214, 1, 0.5],
		[118, 168, 1.2, 0.6],
		[70, 196, 1.5, 0.8],
		[150, 40, 1, 0.5],
		[276, 120, 1.2, 0.5]
	];

	/** A five-pointed star at (x, y), as path data. */
	function star(x: number, y: number, outer: number) {
		const inner = outer * 0.42;
		const points = Array.from({ length: 10 }, (_, index) => {
			const radius = index % 2 ? inner : outer;
			const angle = -Math.PI / 2 + (index * Math.PI) / 5;
			return `${(x + Math.cos(angle) * radius).toFixed(1)} ${(y + Math.sin(angle) * radius).toFixed(1)}`;
		});
		return `M${points.join('L')}Z`;
	}

	// The selected sail's box, in the artboard's units.
	const box = { x: 152, y: 204, width: 62, height: 108 };
	const handles = [
		[0, 0],
		[0.5, 0],
		[1, 0],
		[1, 0.5],
		[1, 1],
		[0.5, 1],
		[0, 1],
		[0, 0.5]
	].map(([fx, fy]) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy }));

	const layers: {
		name: string;
		icon: IconName;
		current?: boolean;
		shapes?: { name: string; icon: IconName; picked?: boolean }[];
	}[] = [
		{ name: 'Sea', icon: 'layers' },
		{
			name: 'The Meridian',
			icon: 'layers',
			current: true,
			shapes: [
				{ name: 'Big sail', icon: 'pen-nib', picked: true },
				{ name: 'Small sail', icon: 'pen-nib' },
				{ name: 'Hull', icon: 'pen-nib' }
			]
		},
		{ name: 'Moon', icon: 'layers' },
		{ name: 'Stars', icon: 'layers' }
	];
</script>

<div class="window" aria-hidden="true">
	<div class="bar">
		<span class="bar-start">
			<Icon name="arrow-left" size={14} />
			<span class="bar-title">The Glass Armada, cover</span>
			<span class="bar-status"><Icon name="check" size={11} />Kept in this browser</span>
		</span>
		<span class="bar-end">
			<span class="bar-history"><Icon name="undo" size={14} /><Icon name="redo" size={14} /></span>
			<span class="bar-zoom">25%</span>
			<span class="bar-download"><Icon name="download" size={12} />Download</span>
		</span>
	</div>

	<div class="rail">
		{#each tools as tool (tool.icon)}
			<span class="tool" class:on={tool.on}
				><Icon name={tool.icon} size={15} strokeWidth={1.8} /></span
			>
		{/each}
		<span class="wells">
			<span class="well fill"></span>
			<span class="well stroke"></span>
		</span>
	</div>

	<div class="desk">
		<svg class="art" viewBox="-12 -12 324 474">
			<defs>
				<filter id="studio-shadow" x="-20%" y="-20%" width="140%" height="140%">
					<feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.35" />
				</filter>
			</defs>
			<!-- The shadow on a rect of its own: a filter shifts the colour of what it's on. -->
			<rect width="300" height="450" fill="#0d1330" filter="url(#studio-shadow)" />
			<rect width="300" height="450" fill="#0d1330" />

			<!-- Stars -->
			{#each dots as [x, y, r, opacity], index (index)}
				<circle
					class="twinkle"
					style:--delay="{(index % 5) * 0.7}s"
					cx={x}
					cy={y}
					{r}
					fill="#f5f0e6"
					fill-opacity={opacity}
				/>
			{/each}
			<path d={star(48, 98, 6)} fill="#f5f0e6" />
			<path d={star(236, 252, 4.5)} fill="#f5f0e6" fill-opacity="0.8" />
			<path d={star(104, 236, 3.5)} fill="#f5f0e6" fill-opacity="0.7" />

			<!-- The moon: a disc, and the sky's own colour over most of it -->
			<circle cx="198" cy="112" r="52" fill="#f2e3bf" />
			<circle cx="222" cy="98" r="46" fill="#0d1330" />

			<!-- The far fleet, glass ships on the horizon -->
			<g opacity="0.55">
				<path
					d="M44 286 L44 252 L62 286 Z"
					fill="#7cb4ff"
					fill-opacity="0.6"
					stroke="#cfe3ff"
					stroke-width="0.8"
				/>
				<path d="M36 288 L66 288 L62 293 L40 293 Z" fill="#2b63f5" />
				<path
					d="M258 284 L258 258 L272 284 Z"
					fill="#7cb4ff"
					fill-opacity="0.6"
					stroke="#cfe3ff"
					stroke-width="0.8"
				/>
				<path d="M252 286 L276 286 L273 290 L255 290 Z" fill="#2b63f5" />
			</g>

			<!-- The far sea -->
			<path
				d="M0 296 C36 286 78 306 120 296 S204 284 244 298 S288 292 300 296 V450 H0 Z"
				fill="#1f4e6b"
			/>

			<!-- The Meridian -->
			<path d="M150 314 L150 196" stroke="#cfe3ff" stroke-width="2" stroke-linecap="round" />
			<path
				d="M148 222 L148 312 L102 312 Z"
				fill="#7cb4ff"
				fill-opacity="0.4"
				stroke="#cfe3ff"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
			<path
				d="M152 204 L152 312 L214 312 Z"
				fill="#7cb4ff"
				fill-opacity="0.55"
				stroke="#cfe3ff"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
			<path
				d="M94 316 L206 316 L190 338 L110 338 Z"
				fill="#2b63f5"
				fill-opacity="0.9"
				stroke="#cfe3ff"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>

			<!-- The near sea, and the moon on it -->
			<path d="M0 334 C50 322 92 346 150 336 S250 324 300 338 V450 H0 Z" fill="#163a55" />
			<path d="M0 372 C60 360 110 384 170 372 S262 362 300 376 V450 H0 Z" fill="#0f2a42" />
			<g stroke="#f2e3bf" stroke-linecap="round" stroke-opacity="0.45" stroke-width="2">
				<path d="M176 352 H206" />
				<path d="M184 362 H200" />
				<path d="M170 390 H192" />
			</g>

			<!-- A beacon under the ice, singing its seven notes -->
			<circle
				class="beacon"
				cx="84"
				cy="412"
				r="20"
				fill="none"
				stroke="#e8b04b"
				stroke-width="1.2"
			/>
			<circle
				cx="84"
				cy="412"
				r="11"
				fill="none"
				stroke="#e8b04b"
				stroke-opacity="0.5"
				stroke-width="1.4"
			/>
			<circle cx="84" cy="412" r="4.5" fill="#e8b04b" />

			<!-- The selection: the big sail, with its handles -->
			<rect class="select" x={box.x} y={box.y} width={box.width} height={box.height} />
			{#each handles as handle, index (index)}
				<rect
					class="handle"
					x={handle.x - 2.6}
					y={handle.y - 2.6}
					width="5.2"
					height="5.2"
					rx="0.8"
				/>
			{/each}
		</svg>
	</div>

	<div class="panels">
		<div class="panel">
			<span class="panel-title">Path</span>
			<span class="fields">
				<span class="field"><b>X</b>912</span>
				<span class="field"><b>Y</b>1224</span>
				<span class="field"><b>W</b>372</span>
				<span class="field"><b>H</b>648</span>
			</span>
			<span class="panel-title">Fill and stroke</span>
			<span class="paint"><span class="swatch sail"></span>Fill<span class="dim">55%</span></span>
			<span class="paint"
				><span class="swatch ring"></span><span class="field wide"><b>—</b>9</span></span
			>
		</div>
		<div class="panel layers">
			<span class="panel-title">Layers</span>
			{#each layers as layer (layer.name)}
				<span class="layer" class:current={layer.current}>
					<Icon name={layer.shapes ? 'chevron-down' : 'chevron-right'} size={10} />
					<Icon name={layer.icon} size={12} />
					{layer.name}
				</span>
				{#each layer.shapes ?? [] as shape (shape.name)}
					<span class="shape" class:picked={shape.picked}
						><Icon name={shape.icon} size={11} />{shape.name}</span
					>
				{/each}
			{/each}
		</div>
	</div>
</div>

<style>
	.window {
		--accent: #2f6bff;
		--chrome: light-dark(#f8f4ec, #0d1330);
		--desk: light-dark(#e4dfd4, #060a1a);
		--field: light-dark(rgba(20, 28, 69, 0.06), rgba(255, 255, 255, 0.06));

		display: grid;
		grid-template:
			'bar bar bar' 40px
			'rail desk panels' 1fr
			/ 46px minmax(0, 1fr) 210px;
		height: 560px;
		overflow: hidden;
		border: 1px solid var(--bb-line-soft);
		border-radius: 18px;
		background: var(--chrome);
		box-shadow: 0 40px 80px -40px var(--bb-drop);
		color: var(--bb-text-label);
		font-family: var(--font-ui);
		font-size: 11px;
		user-select: none;
	}

	.bar {
		grid-area: bar;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 0 12px;
		border-bottom: 1px solid var(--bb-line-faint);
	}

	.bar-start,
	.bar-end {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.bar-title {
		overflow: hidden;
		color: var(--bb-text-strong);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.bar-status {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--bb-text-3);
		white-space: nowrap;
	}

	.bar-history {
		display: flex;
		gap: 12px;
	}

	.bar-zoom {
		font-weight: 600;
	}

	.bar-download {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 10px;
		border-radius: 7px;
		background: var(--bb-royal);
		color: #fff;
		font-weight: 600;
	}

	.rail {
		grid-area: rail;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 8px 0;
		border-right: 1px solid var(--bb-line-faint);
	}

	.tool {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
	}

	.tool.on {
		background: var(--accent);
		color: #fff;
	}

	.wells {
		position: relative;
		width: 30px;
		height: 30px;
		margin-top: auto;
	}

	.well {
		position: absolute;
		width: 19px;
		height: 19px;
		border-radius: 5px;
	}

	.well.fill {
		top: 0;
		left: 0;
		z-index: 1;
		border: 1px solid var(--bb-line-control);
		background: #7cb4ff;
	}

	.well.stroke {
		right: 0;
		bottom: 0;
		border: 1px solid var(--bb-line-control);
		background: var(--chrome);
		box-shadow: inset 0 0 0 4px #cfe3ff;
	}

	.desk {
		grid-area: desk;
		display: grid;
		place-items: center;
		min-height: 0;
		padding: 18px;
		background: var(--desk);
	}

	.art {
		width: auto;
		height: 100%;
		max-width: 100%;
	}

	.select {
		fill: none;
		stroke: var(--accent);
		stroke-width: 1;
	}

	.handle {
		fill: #fff;
		stroke: var(--accent);
		stroke-width: 1;
	}

	.twinkle {
		animation: twinkle 3.6s ease-in-out infinite;
		animation-delay: var(--delay);
	}

	.beacon {
		transform-origin: 84px 412px;
		animation: beacon 3.2s ease-out infinite;
	}

	@keyframes twinkle {
		50% {
			opacity: 0.35;
		}
	}

	@keyframes beacon {
		from {
			opacity: 0.8;
			transform: scale(0.55);
		}
		to {
			opacity: 0;
			transform: scale(1.35);
		}
	}

	.panels {
		grid-area: panels;
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-left: 1px solid var(--bb-line-faint);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border-bottom: 1px solid var(--bb-line-faint);
	}

	.panel-title {
		color: var(--bb-text-label);
		font-weight: 700;
	}

	.fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.field {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 24px;
		padding: 0 8px;
		border-radius: 6px;
		background: var(--field);
		color: var(--bb-text);
		font-variant-numeric: tabular-nums;
	}

	.field b {
		color: var(--bb-text-3);
		font-size: 9.5px;
	}

	.field.wide {
		flex: 1;
	}

	.paint {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--bb-text-2);
	}

	.dim {
		margin-left: auto;
		color: var(--bb-text-3);
	}

	.swatch {
		flex: none;
		width: 22px;
		height: 22px;
		border: 1px solid var(--bb-line-control);
		border-radius: 6px;
	}

	.swatch.sail {
		background:
			linear-gradient(rgba(124, 180, 255, 0.55), rgba(124, 180, 255, 0.55)),
			repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 6px 6px;
	}

	.swatch.ring {
		background: var(--chrome);
		box-shadow: inset 0 0 0 5px #cfe3ff;
	}

	.layers {
		flex: 1;
		gap: 2px;
		border-bottom: none;
	}

	.layers .panel-title {
		margin-bottom: 4px;
	}

	.layer,
	.shape {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 6px;
		border-radius: 6px;
		color: var(--bb-text-2);
	}

	.layer.current {
		background: color-mix(in srgb, var(--accent) 16%, transparent);
		color: var(--bb-text-strong);
		font-weight: 600;
	}

	.shape {
		padding-left: 26px;
	}

	.shape.picked {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		color: var(--bb-text-strong);
	}

	@media (max-width: 900px) {
		.window {
			grid-template-columns: 46px minmax(0, 1fr);
			grid-template-areas:
				'bar bar'
				'rail desk';
		}

		.panels {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.window {
			height: 460px;
			grid-template-columns: 40px minmax(0, 1fr);
		}

		.bar-status,
		.bar-history,
		.bar-zoom {
			display: none;
		}

		.bar-download {
			padding: 5px 8px;
		}

		.desk {
			padding: 12px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.twinkle,
		.beacon {
			animation: none;
		}
	}
</style>
