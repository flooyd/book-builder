<script lang="ts">
	import Icon, { type IconName } from '$lib/components/ui/Icon.svelte';
	import { kindLabel, type LineCap, type LineJoin, type Shape, type Stroke } from '$lib/drawing';
	import {
		apply,
		decompose,
		invert,
		multiply,
		rotation,
		scaling,
		translation
	} from '$lib/studio/geometry';
	import type { Studio } from '$lib/studio/studio.svelte';
	import { pencilSettings } from '$lib/studio/tools/pencil.svelte';
	import { shapeDefaults } from '$lib/studio/tools/shape.svelte';
	import { selectionFrame } from '$lib/studio/tools/marks';
	import ColorWell from './ColorWell.svelte';
	import NumberField from './NumberField.svelte';

	// The properties panel. With something selected: where it is and how big, its own settings
	// (corners, sides, points, arrowheads), its fill, stroke and opacity, and what can be done to
	// it. With nothing selected: the drawing's size and ground, and what new shapes are drawn with.
	// The tool in hand adds its own options at the top.
	let { studio, side = 'left' }: { studio: Studio; side?: 'left' | 'above' } = $props();

	const shapes = $derived(studio.selected.map((item) => item.shape));
	const first = $derived<Shape | null>(shapes[0] ?? null);
	const frame = $derived(selectionFrame(studio.doc, studio.selection));
	const single = $derived(shapes.length === 1);

	const box = $derived.by(() => {
		if (!frame) return null;
		const { bounds, matrix } = frame;
		const corner = apply(matrix, bounds.minX, bounds.minY);
		return {
			x: corner.x,
			y: corner.y,
			width: bounds.maxX - bounds.minX,
			height: bounds.maxY - bounds.minY,
			rotation: single ? (decompose(matrix).rotation * 180) / Math.PI : 0
		};
	});

	let keepRatio = $state(false);
	const mergeOf = (key: string, live: boolean) => (live ? `inspector-${key}` : undefined);

	function moveTo(axis: 'x' | 'y', value: number, live: boolean) {
		if (!box) return;
		const by = value - box[axis];
		if (Math.abs(by) < 1e-6) return;
		studio.transformSelection(
			axis === 'x' ? translation(by, 0) : translation(0, by),
			mergeOf(axis, live)
		);
	}

	function resizeTo(axis: 'width' | 'height', value: number, live: boolean) {
		if (!box || !frame) return;
		const now = box[axis];
		if (now <= 0 || value <= 0) return;
		const factor = value / now;
		const sx = axis === 'width' || keepRatio ? factor : 1;
		const sy = axis === 'height' || keepRatio ? factor : 1;
		const back = invert(frame.matrix);
		if (!back) return;
		const local = scaling(sx, sy, frame.bounds.minX, frame.bounds.minY);
		studio.transformSelection(multiply(frame.matrix, multiply(local, back)), mergeOf(axis, live));
	}

	function turnTo(degrees: number, live: boolean) {
		if (!box || !frame) return;
		const by = ((degrees - box.rotation) * Math.PI) / 180;
		if (Math.abs(by) < 1e-9) return;
		const { bounds, matrix } = frame;
		const centre = apply(matrix, (bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
		studio.transformSelection(rotation(by, centre.x, centre.y), mergeOf('rotation', live));
	}

	// ---- Paint ----
	const painted = $derived(shapes.filter((shape) => shape.kind !== 'group'));
	const fillable = $derived(painted.filter((shape) => shape.kind !== 'line'));
	const fillOf = (shape: Shape) =>
		shape.kind === 'group' || shape.kind === 'line' ? null : (shape.fill?.color ?? null);
	const strokeOf = (shape: Shape): Stroke | null => (shape.kind === 'group' ? null : shape.stroke);
	const fill = $derived(fillable.length ? fillOf(fillable[0]) : null);
	const fillMixed = $derived(fillable.some((shape) => fillOf(shape) !== fill));
	const stroke = $derived(painted.length ? strokeOf(painted[0]) : null);
	const strokeMixed = $derived(
		painted.some((shape) => strokeOf(shape)?.paint.color !== stroke?.paint.color)
	);
	const opacity = $derived(first ? first.opacity : 1);

	const DASHES: { key: string; label: string; dash: number[] }[] = [
		{ key: 'solid', label: 'Solid', dash: [] },
		{ key: 'dashed', label: 'Dashed', dash: [3, 2] },
		{ key: 'dotted', label: 'Dotted', dash: [0.01, 2] }
	];
	const dashKey = (dash: number[]) =>
		!dash.length ? 'solid' : dash[0] < 0.1 ? 'dotted' : 'dashed';

	function setDash(key: string) {
		const found = DASHES.find((item) => item.key === key) ?? DASHES[0];
		studio.changeStroke((stroke) => ({
			...stroke,
			dash: found.dash,
			// Dots are round ends on dashes of no length.
			cap: key === 'dotted' ? 'round' : stroke.cap
		}));
	}

	// ---- Tool options ----
	const TIPS: Partial<Record<string, string>> = {
		select:
			'Shift adds to the selection. Alt-drag moves a copy. Drag just outside a corner to turn.',
		direct:
			'Drag points or their handles. Double-click a point to make it sharp or smooth; double-click a line to add one.',
		pen: 'Click for a sharp point, drag for a curve. Click the first point to close; Enter or Esc to finish.',
		pencil: 'Draw freely; the line becomes smooth curves. End where you began to close it.',
		rect: 'Shift keeps it square; Alt draws from the centre.',
		ellipse: 'Shift keeps it round; Alt draws from the centre.',
		polygon: 'Shift keeps it even; Alt draws from the centre.',
		star: 'Shift keeps it even; Alt draws from the centre.',
		line: 'Shift keeps to 45° steps.',
		arrow: 'Shift keeps to 45° steps.',
		hand: 'Drag to move round the drawing. Hold Space with any tool to do the same.',
		zoom: 'Click to zoom in, Alt-click to zoom out, or drag round what to see.'
	};
	const tip = $derived(TIPS[studio.tool] ?? '');

	type Action = { icon: IconName; label: string; run: () => void; show?: boolean };
	const actions = $derived<Action[]>([
		{ icon: 'copy', label: 'Duplicate (Ctrl+D)', run: () => studio.duplicateSelection() },
		{
			icon: 'bring-forward',
			label: 'Bring forward (Ctrl+])',
			run: () => studio.arrange('forward')
		},
		{
			icon: 'send-backward',
			label: 'Send backward (Ctrl+[)',
			run: () => studio.arrange('backward')
		},
		{ icon: 'flip-h', label: 'Flip across (Shift+H)', run: () => studio.flip(true) },
		{ icon: 'flip-v', label: 'Flip up and down (Shift+V)', run: () => studio.flip(false) },
		{ icon: 'group', label: 'Group (Ctrl+G)', run: () => studio.group(), show: shapes.length > 1 },
		{
			icon: 'ungroup',
			label: 'Ungroup (Ctrl+Shift+G)',
			run: () => studio.ungroup(),
			show: shapes.some((shape) => shape.kind === 'group')
		},
		{ icon: 'trash', label: 'Delete (Delete)', run: () => studio.deleteSelection() }
	]);

	const remember = (color: string | null) => {
		if (color) studio.remember(color);
	};

	function changeKind<K extends Shape['kind']>(
		kind: K,
		change: (shape: Extract<Shape, { kind: K }>) => Shape,
		live: boolean,
		key: string
	) {
		studio.changeSelected(
			(shape) => (shape.kind === kind ? change(shape as Extract<Shape, { kind: K }>) : shape),
			mergeOf(key, live)
		);
	}
</script>

<div class="inspector">
	{#if studio.tool === 'pencil' || studio.tool === 'polygon' || studio.tool === 'star' || studio.tool === 'rect'}
		<section aria-labelledby="tool-options">
			<h3 id="tool-options">{studio.tool === 'pencil' ? 'Pencil' : 'New shapes'}</h3>
			<div class="grid">
				{#if studio.tool === 'pencil'}
					<div class="wide">
						<NumberField
							label="Smoothing"
							icon="tidy"
							value={pencilSettings.smoothing * 100}
							min={0}
							max={100}
							places={0}
							unit="%"
							title="How steady the line is"
							onchange={(value) => (pencilSettings.smoothing = value / 100)}
						/>
					</div>
				{:else if studio.tool === 'polygon'}
					<NumberField
						label="Sides"
						icon="hexagon"
						value={shapeDefaults.sides}
						min={3}
						max={60}
						places={0}
						title="Sides"
						onchange={(value) => (shapeDefaults.sides = Math.round(value))}
					/>
				{:else if studio.tool === 'star'}
					<NumberField
						label="Points"
						icon="star"
						value={shapeDefaults.points}
						min={3}
						max={60}
						places={0}
						title="Points"
						onchange={(value) => (shapeDefaults.points = Math.round(value))}
					/>
					<NumberField
						label="Inner"
						value={shapeDefaults.inner * 100}
						min={5}
						max={95}
						places={0}
						unit="%"
						title="How deep the points go"
						onchange={(value) => (shapeDefaults.inner = value / 100)}
					/>
				{:else}
					<NumberField
						label="Corners"
						icon="square"
						value={shapeDefaults.radius}
						min={0}
						max={2000}
						places={0}
						title="Corner radius"
						onchange={(value) => (shapeDefaults.radius = value)}
					/>
				{/if}
			</div>
		</section>
	{/if}

	{#if first && box}
		<section aria-labelledby="selection-title">
			<div class="title-row">
				<h3 id="selection-title">{single ? kindLabel(first) : `${shapes.length} shapes`}</h3>
			</div>
			<div class="actions">
				{#each actions.filter((action) => action.show !== false) as action (action.icon)}
					<button
						type="button"
						class="icon-button"
						aria-label={action.label}
						title={action.label}
						onclick={action.run}
					>
						<Icon name={action.icon} size={16} />
					</button>
				{/each}
			</div>
		</section>

		<section aria-label="Position and size">
			<div class="grid">
				<NumberField
					label="X"
					value={box.x}
					onchange={(value, live) => moveTo('x', value, live)}
					title="Across from the left edge"
				/>
				<NumberField
					label="Y"
					value={box.y}
					onchange={(value, live) => moveTo('y', value, live)}
					title="Down from the top edge"
				/>
				<NumberField
					label="W"
					value={box.width}
					min={0.01}
					onchange={(value, live) => resizeTo('width', value, live)}
					title="Width"
				/>
				<div class="with-lock">
					<NumberField
						label="H"
						value={box.height}
						min={0.01}
						onchange={(value, live) => resizeTo('height', value, live)}
						title="Height"
					/>
					<button
						type="button"
						class="lock"
						aria-pressed={keepRatio}
						aria-label="Keep the proportions"
						title="Keep the proportions"
						onclick={() => (keepRatio = !keepRatio)}
					>
						<Icon name={keepRatio ? 'lock' : 'unlock'} size={13} />
					</button>
				</div>
				{#if single}
					<NumberField
						label="Turn"
						icon="tidy"
						value={box.rotation}
						places={1}
						unit="°"
						onchange={(value, live) => turnTo(value, live)}
						title="Turned by"
					/>
				{/if}
				{#if first.kind === 'rect'}
					<NumberField
						label="Corners"
						icon="square"
						value={first.radius}
						min={0}
						places={1}
						title="Corner radius"
						onchange={(value, live) =>
							changeKind('rect', (shape) => ({ ...shape, radius: value }), live, 'radius')}
					/>
				{:else if first.kind === 'polygon'}
					<NumberField
						label="Sides"
						icon="hexagon"
						value={first.sides}
						min={3}
						max={60}
						places={0}
						title="Sides"
						onchange={(value, live) =>
							changeKind(
								'polygon',
								(shape) => ({ ...shape, sides: Math.round(value) }),
								live,
								'sides'
							)}
					/>
				{:else if first.kind === 'star'}
					<NumberField
						label="Points"
						icon="star"
						value={first.points}
						min={3}
						max={60}
						places={0}
						title="Points"
						onchange={(value, live) =>
							changeKind(
								'star',
								(shape) => ({ ...shape, points: Math.round(value) }),
								live,
								'points'
							)}
					/>
					<NumberField
						label="Inner"
						value={first.inner * 100}
						min={5}
						max={95}
						places={0}
						unit="%"
						title="How deep the points go"
						onchange={(value, live) =>
							changeKind('star', (shape) => ({ ...shape, inner: value / 100 }), live, 'inner')}
					/>
				{/if}
			</div>
			{#if first.kind === 'line'}
				<div class="ends">
					<span class="small-label">Arrowheads</span>
					<button
						type="button"
						class="toggle"
						aria-pressed={first.start === 'arrow'}
						onclick={() =>
							changeKind(
								'line',
								(shape) => ({ ...shape, start: shape.start === 'arrow' ? 'none' : 'arrow' }),
								false,
								'start'
							)}
					>
						Start
					</button>
					<button
						type="button"
						class="toggle"
						aria-pressed={first.end === 'arrow'}
						onclick={() =>
							changeKind(
								'line',
								(shape) => ({ ...shape, end: shape.end === 'arrow' ? 'none' : 'arrow' }),
								false,
								'end'
							)}
					>
						End
					</button>
				</div>
			{/if}
		</section>

		{#if painted.length}
			<section aria-labelledby="paint-title">
				<h3 id="paint-title">Fill and stroke</h3>
				{#if fillable.length}
					<div class="paint-row">
						<ColorWell
							value={fillMixed ? null : fill}
							label="Fill"
							{side}
							recent={studio.recent}
							onchange={(color) => studio.setFill(color, 'fill')}
							onclose={remember}
						/>
						<span class="paint-name">{fillMixed ? 'Mixed' : fill ? 'Fill' : 'No fill'}</span>
					</div>
				{/if}
				<div class="paint-row">
					<ColorWell
						value={strokeMixed ? null : (stroke?.paint.color ?? null)}
						label="Stroke"
						stroke
						{side}
						none={painted.every((shape) => shape.kind !== 'line')}
						recent={studio.recent}
						onchange={(color) => studio.setStroke(color, 'stroke')}
						onclose={remember}
					/>
					{#if stroke}
						<NumberField
							label="Width"
							icon="minus"
							value={stroke.width}
							min={0.1}
							max={1000}
							places={1}
							title="Stroke width"
							onchange={(value, live) => {
								studio.style.strokeWidth = value;
								studio.changeStroke(
									(item) => ({ ...item, width: value }),
									mergeOf('stroke-width', live)
								);
							}}
						/>
					{:else}
						<span class="paint-name">No stroke</span>
					{/if}
				</div>
				{#if stroke}
					<div class="grid">
						<label class="select">
							<span class="sr-only">Line</span>
							<select
								value={dashKey(stroke.dash)}
								onchange={(event) => setDash(event.currentTarget.value)}
								title="Line"
							>
								{#each DASHES as dash (dash.key)}
									<option value={dash.key}>{dash.label}</option>
								{/each}
							</select>
						</label>
						<label class="select">
							<span class="sr-only">Ends</span>
							<select
								value={stroke.cap}
								title="Ends"
								onchange={(event) => {
									const cap = event.currentTarget.value as LineCap;
									studio.changeStroke((item) => ({ ...item, cap }));
								}}
							>
								<option value="round">Round ends</option>
								<option value="square">Square ends</option>
								<option value="butt">Flat ends</option>
							</select>
						</label>
						{#if first.kind !== 'line' && first.kind !== 'ellipse'}
							<label class="select wide">
								<span class="sr-only">Corners</span>
								<select
									value={stroke.join}
									title="Corners"
									onchange={(event) => {
										const join = event.currentTarget.value as LineJoin;
										studio.changeStroke((item) => ({ ...item, join }));
									}}
								>
									<option value="round">Round corners</option>
									<option value="miter">Sharp corners</option>
									<option value="bevel">Cut corners</option>
								</select>
							</label>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		<section aria-label="Opacity">
			<div class="grid">
				<div class="wide">
					<NumberField
						label="Opacity"
						icon="eye"
						value={opacity * 100}
						min={0}
						max={100}
						places={0}
						unit="%"
						title="Opacity"
						onchange={(value, live) =>
							studio.changeSelected(
								(shape) => ({ ...shape, opacity: value / 100 }),
								mergeOf('opacity', live)
							)}
					/>
				</div>
			</div>
		</section>
	{:else}
		<section aria-labelledby="drawing-title">
			<h3 id="drawing-title">Drawing</h3>
			<div class="grid">
				<NumberField
					label="W"
					value={studio.doc.width}
					min={16}
					max={4096}
					places={0}
					title="Width in pixels"
					onchange={(value, live) =>
						studio.resizeDrawing(value, studio.doc.height, live ? 'board-size' : undefined)}
				/>
				<NumberField
					label="H"
					value={studio.doc.height}
					min={16}
					max={4096}
					places={0}
					title="Height in pixels"
					onchange={(value, live) =>
						studio.resizeDrawing(studio.doc.width, value, live ? 'board-size' : undefined)}
				/>
			</div>
			<div class="paint-row">
				<ColorWell
					value={studio.doc.background}
					label="Ground"
					{side}
					recent={studio.recent}
					onchange={(color) => studio.setBackground(color, 'background')}
					onclose={remember}
				/>
				<span class="paint-name">{studio.doc.background ? 'Ground' : 'Clear ground'}</span>
			</div>
		</section>

		<section aria-labelledby="style-title">
			<h3 id="style-title">New shapes</h3>
			<div class="paint-row">
				<ColorWell
					value={studio.style.fill}
					label="Fill for new shapes"
					{side}
					recent={studio.recent}
					onchange={(color) => (studio.style.fill = color)}
					onclose={remember}
				/>
				<span class="paint-name">{studio.style.fill ? 'Fill' : 'No fill'}</span>
			</div>
			<div class="paint-row">
				<ColorWell
					value={studio.style.stroke}
					label="Stroke for new shapes"
					stroke
					{side}
					recent={studio.recent}
					onchange={(color) => (studio.style.stroke = color)}
					onclose={remember}
				/>
				<NumberField
					label="Width"
					icon="minus"
					value={studio.style.strokeWidth}
					min={0.1}
					max={1000}
					places={1}
					title="Stroke width"
					onchange={(value) => (studio.style.strokeWidth = value)}
				/>
			</div>
		</section>
	{/if}

	{#if tip}
		<p class="tip">{tip}</p>
	{/if}
</div>

<style>
	.inspector {
		display: flex;
		flex-direction: column;
		font-family: var(--font-ui);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 14px 16px;
		border-bottom: 1px solid var(--bb-line-faint);
	}

	h3 {
		margin: 0;
		color: var(--bb-text-label);
		font-size: 12.5px;
		font-weight: 700;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.wide {
		grid-column: 1 / -1;
	}

	.with-lock {
		position: relative;
	}

	.lock {
		position: absolute;
		top: 50%;
		right: 4px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: 5px;
		background: none;
		color: var(--bb-text-3);
		transform: translateY(-50%);
	}

	.lock[aria-pressed='true'] {
		color: var(--studio-accent);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		margin: 0 -6px;
	}

	.icon-button {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: none;
		color: var(--bb-text-label);
	}

	.icon-button:hover {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.paint-row {
		display: grid;
		grid-template-columns: 28px 1fr;
		align-items: center;
		gap: 10px;
	}

	.paint-name {
		color: var(--bb-text-2);
		font-size: 12.5px;
	}

	.ends {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.small-label {
		flex: 1;
		color: var(--bb-text-3);
		font-size: 12px;
	}

	.toggle {
		min-height: 28px;
		padding: 0 10px;
		border: 1px solid var(--bb-line-control);
		border-radius: 7px;
		background: none;
		color: var(--bb-text-2);
		font: 600 12px var(--font-ui);
	}

	.toggle[aria-pressed='true'] {
		border-color: var(--studio-accent);
		background: color-mix(in srgb, var(--studio-accent) 14%, transparent);
		color: var(--bb-text-strong);
	}

	.select select {
		width: 100%;
		height: 32px;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: var(--studio-field);
		color: var(--bb-text);
		font: 500 12.5px var(--font-ui);
	}

	.select select:hover {
		border-color: var(--bb-line-soft);
	}

	.tip {
		margin: 0;
		padding: 14px 16px;
		color: var(--bb-text-3);
		font-size: 12px;
		line-height: 1.5;
	}
</style>
