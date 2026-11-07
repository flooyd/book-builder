<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { ENTRY_COPY } from '$lib/bible';
	import {
		bends,
		curve,
		layoutWeb,
		linkLength,
		nodeRadius,
		type MapEdge,
		type MapNode,
		type Point,
		type RelationKind
	} from '$lib/connections';
	import { initials, plural } from '$lib/library';
	import Icon from '$lib/components/ui/Icon.svelte';

	// The web itself: entries as shapes, connections as labelled lines, laid out in the browser by
	// $lib/connections. Drag the background to look around, drag an entry (or use the arrow keys on
	// it) to move it, and scroll or pinch to zoom. Where the writer moves things is remembered in this
	// browser only, so nothing is saved to the server.
	let {
		nodes,
		edges,
		shown,
		matches,
		selected = $bindable(),
		storageKey,
		elsewhere,
		empty,
		onready
	}: {
		/** In the order the keyboard reaches them. */
		nodes: MapNode[];
		edges: MapEdge[];
		/** Which kinds of connection to draw. */
		shown: Record<RelationKind, boolean>;
		/** The entries a search found, or null when there's no search. */
		matches: string[] | null;
		selected: string | null;
		/** Where this map's arrangement is kept in the browser. */
		storageKey: string;
		/** What a visiting entry is called: "from another book". */
		elsewhere: string;
		/** Shown in the middle of the map when there's nothing to draw. */
		empty?: Snippet;
		/** Called once, when the web is first laid out and in view. */
		onready?: () => void;
	} = $props();

	const MIN_ZOOM = 0.2;
	const MAX_ZOOM = 2.5;
	const clamp = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

	let surface = $state<HTMLDivElement>();
	let width = $state(0);
	let height = $state(0);
	let positions = $state<Record<string, Point>>({});
	let view = $state({ x: 0, y: 0, k: 1 });
	let hovered = $state<string | null>(null);
	let fitted = $state(false);
	/** What a tidy-up replaced, for its Undo. */
	let untidy = $state<{ positions: Record<string, Point>; arranged: boolean } | null>(null);

	/** The writer has moved something, so the layout is theirs and is kept. */
	let arranged = false;
	/** Where things were left last time, including entries that aren't on the map just now. */
	let saved: Record<string, Point> | null = null;

	// ---- Remembering the arrangement --------------------------------------------------------

	function readSaved(): Record<string, Point> {
		try {
			const value = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
			const points: Record<string, Point> = {};
			for (const [key, point] of Object.entries(value ?? {})) {
				const { x, y } = (point ?? {}) as Partial<Point>;
				if (Number.isFinite(x) && Number.isFinite(y)) points[key] = { x: x!, y: y! };
			}
			return points;
		} catch {
			return {};
		}
	}

	function remember() {
		arranged = true;
		saved = { ...saved, ...$state.snapshot(positions) };
		try {
			localStorage.setItem(storageKey, JSON.stringify(saved));
		} catch {
			// A private window or full storage: the arrangement lasts until the page closes.
		}
	}

	function forget() {
		arranged = false;
		saved = {};
		try {
			localStorage.removeItem(storageKey);
		} catch {
			// Nothing was kept, then.
		}
	}

	// ---- Laying out -------------------------------------------------------------------------

	const links = $derived(
		edges.map((edge) => ({ from: edge.from, to: edge.to, length: linkLength(edge.label) }))
	);

	// New entries find a place among the ones already drawn, so the web never reshuffles under the
	// writer's hands. Only Tidy up lays the whole thing out again.
	$effect(() => {
		const keys = nodes.map((node) => node.key);
		const current = links;
		untrack(() => place(keys, current));
	});

	function place(keys: string[], current: typeof links) {
		const missing = keys.filter((key) => !positions[key]);
		if (missing.length === 0) return;
		if (!saved) {
			saved = readSaved();
			arranged = Object.keys(saved).length > 0;
		}
		const placed: Record<string, Point> = {};
		for (const key of keys) {
			const point = positions[key] ?? saved[key];
			if (point) placed[key] = point;
		}
		const next = layoutWeb(keys, current, placed);
		for (const key of missing) positions[key] = next[key];
		if (arranged) remember();
	}

	// The first time there's a web and room to show it, frame the lot.
	$effect(() => {
		if (fitted || width === 0 || height === 0 || nodes.length === 0) return;
		if (!nodes.every((node) => positions[node.key])) return;
		untrack(() => {
			fit(false);
			fitted = true;
			onready?.();
		});
	});

	// ---- Moving the view --------------------------------------------------------------------

	let frame = 0;
	let settling = 0;
	const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	const ease = (t: number) => 1 - (1 - t) ** 3;

	function setView(target: { x: number; y: number; k: number }, animate = true) {
		cancelAnimationFrame(frame);
		if (!animate || still()) {
			view = target;
			return;
		}
		const from = { ...view };
		const start = performance.now();
		const step = (now: number) => {
			const t = ease(Math.min(1, (now - start) / 320));
			view = {
				x: from.x + (target.x - from.x) * t,
				y: from.y + (target.y - from.y) * t,
				k: from.k + (target.k - from.k) * t
			};
			if (t < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
	}

	/** The view that shows all of these points, with room for the names under them. */
	function framing(points: Point[]) {
		if (points.length === 0) return { x: width / 2, y: height / 2, k: 1 };
		let [left, right, top, bottom] = [Infinity, -Infinity, Infinity, -Infinity];
		for (const { x, y } of points) {
			[left, right] = [Math.min(left, x), Math.max(right, x)];
			[top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
		}
		[left, right, top, bottom] = [left - 100, right + 100, top - 56, bottom + 76];
		const k = clamp(Math.min(width / (right - left), height / (bottom - top), 1.15));
		return { k, x: width / 2 - ((left + right) / 2) * k, y: height / 2 - ((top + bottom) / 2) * k };
	}

	/** Shows the whole web. */
	export function fit(animate = true) {
		const points = nodes.flatMap((node) => positions[node.key] ?? []);
		setView(framing(points), animate);
	}

	function zoomAt(factor: number, cx: number, cy: number, animate = false) {
		const k = clamp(view.k * factor);
		const target = {
			k,
			x: cx - ((cx - view.x) / view.k) * k,
			y: cy - ((cy - view.y) / view.k) * k
		};
		setView(target, animate);
	}

	/**
	 * Brings an entry into view if it's out of sight, leaving it where it is if not. `coveredFrom` is
	 * where something laid over the page (a phone's bottom sheet) starts, in window coordinates.
	 */
	export function reveal(key: string, coveredFrom = Infinity) {
		const point = positions[key];
		if (!point || !surface) return;
		const box = surface.getBoundingClientRect();
		// Below the sticky header, which the page keeps in --app-header-h.
		const header = parseFloat(
			getComputedStyle(document.documentElement).getPropertyValue('--app-header-h')
		);
		const top = Math.max(box.top, Number.isFinite(header) ? header : 0);
		const bottom = Math.max(top + 140, Math.min(box.bottom, innerHeight, coveredFrom));
		const x = box.left + view.x + point.x * view.k;
		const y = box.top + view.y + point.y * view.k;
		const margin = 60;
		const seen =
			x > box.left + margin && x < box.right - margin && y > top + margin && y < bottom - margin;
		if (seen) return;
		setView({
			k: view.k,
			x: width / 2 - point.x * view.k,
			y: (top + bottom) / 2 - box.top - point.y * view.k
		});
	}

	/** Lays the whole web out afresh, forgetting where things were moved. It can be undone. */
	export function tidy() {
		untidy = { positions: $state.snapshot(positions), arranged };
		forget();
		const keys = nodes.map((node) => node.key);
		const next = layoutWeb(keys, links);
		settle(next);
		setView(framing(keys.map((key) => next[key])));
	}

	function undoTidy() {
		if (!untidy) return;
		const { positions: before, arranged: kept } = untidy;
		untidy = null;
		settle(before);
		if (kept) remember();
		setView(framing(nodes.flatMap((node) => before[node.key] ?? [])));
	}

	/** Moves every entry to its new place, gliding there unless motion is turned down. */
	function settle(next: Record<string, Point>) {
		cancelAnimationFrame(settling);
		const keys = Object.keys(next);
		if (still()) {
			for (const key of keys) positions[key] = next[key];
			return;
		}
		const from: Record<string, Point> = {};
		for (const key of keys) from[key] = { ...(positions[key] ?? next[key]) };
		const start = performance.now();
		const step = (now: number) => {
			const t = ease(Math.min(1, (now - start) / 450));
			for (const key of keys) {
				positions[key] = {
					x: from[key].x + (next[key].x - from[key].x) * t,
					y: from[key].y + (next[key].y - from[key].y) * t
				};
			}
			if (t < 1) settling = requestAnimationFrame(step);
		};
		settling = requestAnimationFrame(step);
	}

	// ---- Pointers ---------------------------------------------------------------------------

	type Gesture =
		| { kind: 'pan'; moved: number }
		| { kind: 'drag'; key: string; start: Point; from: Point; moved: boolean }
		| { kind: 'pinch'; distance: number; k: number; world: Point };

	let gesture: Gesture | null = null;
	/** Where each finger or mouse that's down is, on the map. */
	let pointers: Record<number, Point> = {};

	function local(event: PointerEvent): Point {
		const box = surface!.getBoundingClientRect();
		return { x: event.clientX - box.left, y: event.clientY - box.top };
	}

	function down(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		// The zoom buttons, the undo note and an empty map's message aren't part of the web.
		if ((event.target as Element).closest('.controls, .note, .empty')) return;
		cancelAnimationFrame(frame);
		pointers[event.pointerId] = local(event);
		surface!.setPointerCapture(event.pointerId);
		const down = Object.values(pointers);
		if (down.length === 2) {
			const [a, b] = down;
			const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
			gesture = {
				kind: 'pinch',
				distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
				k: view.k,
				world: { x: (centre.x - view.x) / view.k, y: (centre.y - view.y) / view.k }
			};
			return;
		}
		if (down.length > 2) return;
		const key = (event.target as Element).closest<HTMLElement>('[data-key]')?.dataset.key;
		gesture =
			key && positions[key]
				? { kind: 'drag', key, start: local(event), from: { ...positions[key] }, moved: false }
				: { kind: 'pan', moved: 0 };
	}

	function move(event: PointerEvent) {
		const previous = pointers[event.pointerId];
		if (!previous || !gesture) return;
		const point = local(event);
		pointers[event.pointerId] = point;
		if (gesture.kind === 'pan') {
			const [dx, dy] = [point.x - previous.x, point.y - previous.y];
			view.x += dx;
			view.y += dy;
			gesture.moved += Math.abs(dx) + Math.abs(dy);
		} else if (gesture.kind === 'drag') {
			const [dx, dy] = [point.x - gesture.start.x, point.y - gesture.start.y];
			if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
			gesture.moved = true;
			untidy = null;
			positions[gesture.key] = { x: gesture.from.x + dx / view.k, y: gesture.from.y + dy / view.k };
		} else {
			const [a, b] = Object.values(pointers);
			const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
			const k = clamp((gesture.k * Math.hypot(a.x - b.x, a.y - b.y)) / gesture.distance);
			view = { k, x: centre.x - gesture.world.x * k, y: centre.y - gesture.world.y * k };
		}
	}

	function up(event: PointerEvent) {
		if (!pointers[event.pointerId]) return;
		delete pointers[event.pointerId];
		const ended = gesture;
		const left = Object.keys(pointers).length;
		// After a pinch, the finger still down carries on as a pan, and lifting it selects nothing.
		if (left === 1) gesture = { kind: 'pan', moved: Infinity };
		if (left > 0) return;
		gesture = null;
		if (!ended || event.type === 'pointercancel') return;
		if (ended.kind === 'drag') {
			if (ended.moved) remember();
			else selected = ended.key;
		} else if (ended.kind === 'pan' && ended.moved < 5) {
			selected = null;
		}
	}

	// A wheel turns into a zoom, which needs a listener that may cancel the page's scroll.
	$effect(() => {
		const element = surface;
		if (!element) return;
		const wheel = (event: WheelEvent) => {
			event.preventDefault();
			cancelAnimationFrame(frame);
			const box = element.getBoundingClientRect();
			const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
			// A trackpad pinch arrives as a wheel with ctrl held, in small steps.
			const speed = event.ctrlKey ? 0.01 : 0.0015;
			zoomAt(Math.exp(-delta * speed), event.clientX - box.left, event.clientY - box.top);
		};
		element.addEventListener('wheel', wheel, { passive: false });
		return () => element.removeEventListener('wheel', wheel);
	});

	function keydown(event: KeyboardEvent) {
		const key = (event.target as Element).closest<HTMLElement>('[data-key]')?.dataset.key;
		const arrows: Record<string, Point> = {
			ArrowLeft: { x: -1, y: 0 },
			ArrowRight: { x: 1, y: 0 },
			ArrowUp: { x: 0, y: -1 },
			ArrowDown: { x: 0, y: 1 }
		};
		if (key && positions[key] && arrows[event.key]) {
			event.preventDefault();
			const step = event.shiftKey ? 80 : 20;
			untidy = null;
			positions[key] = {
				x: positions[key].x + arrows[event.key].x * step,
				y: positions[key].y + arrows[event.key].y * step
			};
			remember();
			reveal(key);
		} else if (event.key === '+' || event.key === '=') {
			zoomAt(1.3, width / 2, height / 2, true);
		} else if (event.key === '-' || event.key === '_') {
			zoomAt(1 / 1.3, width / 2, height / 2, true);
		} else if (event.key === '0') {
			fit();
		} else if (event.key === 'Escape' && selected) {
			selected = null;
		}
	}

	// ---- What's drawn -----------------------------------------------------------------------

	const visible = $derived(edges.filter((edge) => shown[edge.kind]));
	const radius = $derived(
		Object.fromEntries(nodes.map((node) => [node.key, nodeRadius(node.degree)])) as Record<
			string,
			number
		>
	);

	/** The entry whose ties are lit up: the one under the pointer or focus, or else the chosen one. */
	const focus = $derived.by(() => {
		const key = hovered ?? selected;
		return key && positions[key] ? key : null;
	});

	/** The entry in focus and everything tied to it. */
	const lit = $derived.by(() => {
		if (!focus) return null;
		const keys: Record<string, true> = { [focus]: true };
		for (const edge of visible) {
			if (edge.from === focus) keys[edge.to] = true;
			else if (edge.to === focus) keys[edge.from] = true;
		}
		return keys;
	});

	/** Entries with a line still drawn to them, once some kinds are hidden. */
	const tied = $derived.by(() => {
		const keys: Record<string, true> = {};
		for (const edge of visible) keys[edge.from] = keys[edge.to] = true;
		return keys;
	});

	const lines = $derived.by(() => {
		const bent = bends(visible);
		return visible.flatMap((edge) => {
			const [a, b] = [positions[edge.from], positions[edge.to]];
			if (!a || !b) return [];
			const geometry = curve(
				a,
				b,
				bent[edge.id] ?? 0,
				(radius[edge.from] ?? 28) + 3,
				(radius[edge.to] ?? 28) + 5
			);
			const state = !focus ? '' : edge.from === focus || edge.to === focus ? 'lit' : 'dim';
			return [{ edge, state, ...geometry }];
		});
	});

	/** The box the lines are drawn in: everything on the map, with room for curves to bow out. */
	const bounds = $derived.by(() => {
		let [left, right, top, bottom] = [0, 0, 0, 0];
		for (const node of nodes) {
			const point = positions[node.key];
			if (!point) continue;
			[left, right] = [Math.min(left, point.x), Math.max(right, point.x)];
			[top, bottom] = [Math.min(top, point.y), Math.max(bottom, point.y)];
		}
		const margin = 200;
		return {
			x: Math.floor(left - margin),
			y: Math.floor(top - margin),
			width: Math.ceil(right - left + margin * 2),
			height: Math.ceil(bottom - top + margin * 2)
		};
	});

	function nodeState(key: string) {
		if (matches) return matches.includes(key) ? 'found' : 'dim';
		if (lit) return lit[key] ? 'lit' : 'dim';
		return tied[key] ? '' : 'faded';
	}

	const describe = (node: MapNode) =>
		[
			node.name,
			ENTRY_COPY[node.type].one,
			plural(node.degree, 'connection'),
			...(node.elsewhere ? [elsewhere] : [])
		].join(', ');
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="surface"
	class:far={view.k < 0.6}
	class:distant={view.k < 0.38}
	class:ready={fitted}
	bind:this={surface}
	bind:clientWidth={width}
	bind:clientHeight={height}
	style:--grid="{24 * view.k}px"
	style:background-position="{view.x}px {view.y}px"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onkeydown={keydown}
>
	<div class="world" style:transform="translate({view.x}px, {view.y}px) scale({view.k})">
		<!-- Sized to the web: a tiny one relying on overflow isn't painted outside its box. -->
		<svg
			class="lines"
			aria-hidden="true"
			width={bounds.width}
			height={bounds.height}
			viewBox="{bounds.x} {bounds.y} {bounds.width} {bounds.height}"
			style:left="{bounds.x}px"
			style:top="{bounds.y}px"
		>
			{#each lines as line (line.edge.id)}
				<g class={['line', line.edge.kind, line.state]}>
					<path class="stroke" d={line.path} />
					<path
						class="head"
						d="M0 0-11-5.5-11 5.5z"
						transform="translate({line.end.x} {line.end.y}) rotate({line.angle})"
					/>
				</g>
			{/each}
		</svg>

		{#each lines as line (line.edge.id)}
			{#if line.edge.label}
				<span
					class={['tie', line.edge.kind, line.state]}
					style:left="{line.mid.x}px"
					style:top="{line.mid.y}px"
					aria-hidden="true">{line.edge.label}</span
				>
			{/if}
		{/each}

		{#each nodes as node (node.key)}
			{@const point = positions[node.key]}
			{#if point}
				<button
					type="button"
					class={['node', node.type, nodeState(node.key), { elsewhere: node.elsewhere }]}
					data-key={node.key}
					style:left="{point.x}px"
					style:top="{point.y}px"
					style:--r="{radius[node.key]}px"
					aria-label={describe(node)}
					aria-pressed={selected === node.key}
					onclick={(event) => {
						// A pointer chooses on release (see up); this is Enter or Space.
						if (event.detail === 0) selected = node.key;
					}}
					onpointerenter={() => (hovered = node.key)}
					onpointerleave={() => (hovered = null)}
					onfocus={(event) => {
						hovered = node.key;
						// Only for the keyboard: an entry that was clicked is in view already.
						if (event.currentTarget.matches(':focus-visible')) reveal(node.key);
					}}
					onblur={() => (hovered = null)}
				>
					<span class="shape"><span>{initials(node.name)}</span></span>
					<span class="name">{node.name}</span>
				</button>
			{/if}
		{/each}
	</div>

	{#if nodes.length === 0 && empty}
		<div class="empty">{@render empty()}</div>
	{/if}

	{#if untidy}
		<p class="note" role="status">
			Tidied up.
			<button type="button" onclick={undoTidy}>Undo</button>
		</p>
	{/if}

	{#if nodes.length > 0}
		<div class="controls" role="group" aria-label="Map controls">
			<button
				type="button"
				aria-label="Zoom in"
				title="Zoom in (+)"
				onclick={() => zoomAt(1.3, width / 2, height / 2, true)}
			>
				<Icon name="plus" size={18} />
			</button>
			<button
				type="button"
				aria-label="Zoom out"
				title="Zoom out (−)"
				onclick={() => zoomAt(1 / 1.3, width / 2, height / 2, true)}
			>
				<Icon name="minus" size={18} />
			</button>
			<button
				type="button"
				aria-label="Show everything"
				title="Show everything (0)"
				onclick={() => fit()}
			>
				<Icon name="fit" size={17} />
			</button>
			<button
				type="button"
				aria-label="Tidy up"
				title="Tidy up: lay the web out afresh"
				onclick={tidy}
			>
				<Icon name="tidy" size={17} />
			</button>
		</div>
	{/if}
</div>

<style>
	.surface {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		cursor: grab;
		background-color: var(--bb-ink);
		background-image: radial-gradient(circle, var(--bb-line-mid) 1.1px, transparent 1.6px);
		background-size: var(--grid) var(--grid);
	}

	.surface:active {
		cursor: grabbing;
	}

	.world {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: 0 0;
		will-change: transform;
		opacity: 0;
	}

	.ready .world {
		opacity: 1;
		transition: opacity 0.3s;
	}

	.lines {
		position: absolute;
		max-width: none;
		overflow: visible;
		pointer-events: none;
	}

	.line {
		transition: opacity 0.15s;
	}

	.stroke {
		fill: none;
		stroke: var(--tie);
		stroke-width: 2;
		stroke-linecap: round;
		vector-effect: non-scaling-stroke;
	}

	.head {
		fill: var(--tie);
	}

	.line.lit .stroke {
		stroke-width: 3;
	}

	.line.dim {
		opacity: 0.14;
	}

	.family {
		--tie: var(--bb-tie-family);
	}

	.allies {
		--tie: var(--bb-tie-allies);
	}

	.rivals {
		--tie: var(--bb-tie-rivals);
	}

	.other {
		--tie: var(--bb-tie-other);
	}

	/* A connection's label sits on its line, which it hides behind a patch of the map's ground. */
	.tie {
		position: absolute;
		transform: translate(-50%, -50%);
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 2px 9px 3px;
		border-radius: var(--r-pill, 999px);
		border: 1px solid color-mix(in srgb, var(--tie) 50%, transparent);
		background: var(--bb-ink);
		color: var(--tie);
		font: 600 12px/1.3 var(--font-ui);
		pointer-events: none;
		transition: opacity 0.15s;
	}

	.tie.dim {
		opacity: 0.12;
	}

	.far .tie:not(.lit) {
		opacity: 0;
	}

	.node {
		position: absolute;
		width: calc(var(--r) * 2);
		height: calc(var(--r) * 2);
		margin: calc(var(--r) * -1) 0 0 calc(var(--r) * -1);
		padding: 0;
		border: none;
		border-radius: 50%;
		background: none;
		color: inherit;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.shape {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: calc(var(--r) * 0.7);
		line-height: 1;
		box-shadow: 0 8px 18px -10px var(--bb-drop);
	}

	.character .shape {
		background: var(--bb-paper);
		box-shadow:
			inset 0 0 0 1px light-dark(rgba(60, 40, 10, 0.2), transparent),
			0 8px 18px -10px var(--bb-drop);
		color: #141c45;
	}

	.place .shape {
		border-radius: 30%;
		background: var(--bb-royal);
		color: #fff;
	}

	/* A system is a diamond: the square turns, and its initials turn back. */
	.system .shape {
		border-radius: 24%;
		transform: rotate(45deg) scale(0.86);
		background: var(--bb-raised);
		box-shadow:
			inset 0 0 0 1px var(--bb-line-dashed),
			0 8px 18px -10px var(--bb-drop);
		color: var(--bb-sky-text);
	}

	.system .shape > span {
		transform: rotate(-45deg);
	}

	.elsewhere .shape {
		background: var(--bb-ink);
		box-shadow: none;
		outline: 2px dashed var(--bb-line-dashed);
		outline-offset: -2px;
		color: var(--bb-text-2);
	}

	.name {
		position: absolute;
		top: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 1px 7px 2px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--bb-ink) 88%, transparent);
		color: var(--bb-text-strong);
		font: 600 13px/1.3 var(--font-ui);
	}

	.distant .node:not(.lit, .found, [aria-pressed='true']) .name {
		opacity: 0;
	}

	.node[aria-pressed='true'] .shape {
		box-shadow:
			0 0 0 3px var(--bb-ink),
			0 0 0 6px var(--bb-sky);
	}

	.node[aria-pressed='true'] .name {
		color: var(--bb-sky);
	}

	.node.found .shape {
		box-shadow:
			0 0 0 3px var(--bb-ink),
			0 0 0 5px var(--bb-amber);
	}

	.node.dim {
		opacity: 0.22;
	}

	.node.faded {
		opacity: 0.4;
	}

	.empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 24px;
		text-align: center;
		cursor: default;
	}

	.controls {
		position: absolute;
		right: 14px;
		bottom: 14px;
		display: flex;
		flex-direction: column;
		padding: 4px;
		border-radius: 14px;
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-ink);
		box-shadow: var(--shadow-card);
		cursor: default;
	}

	.controls button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-2);
	}

	.controls button:hover {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.note {
		position: absolute;
		left: 14px;
		bottom: 14px;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 4px 0 14px;
		border-radius: 12px;
		border: 1px solid var(--bb-line-soft);
		background: var(--bb-ink);
		box-shadow: var(--shadow-card);
		font-size: 14px;
		color: var(--bb-text-2);
		cursor: default;
	}

	.note button {
		min-height: 44px;
		padding: 0 12px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-sky);
		font: 600 14px var(--font-ui);
	}

	.note button:hover {
		background: var(--bb-hover);
	}

	@media (prefers-reduced-motion: reduce) {
		.ready .world,
		.line,
		.tie,
		.node {
			transition: none;
		}
	}
</style>
