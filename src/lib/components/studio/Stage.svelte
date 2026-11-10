<script lang="ts">
	import { flushSync, onMount } from 'svelte';
	import { Renderer } from '$lib/studio/render';
	import type { Studio, ToolId } from '$lib/studio/studio.svelte';
	import type { Press, Tool } from '$lib/studio/tools/tool';
	import Overlay from './Overlay.svelte';
	import TextEditor from './TextEditor.svelte';

	// The stage: the drawing on a canvas, the tool's marks over it, and the pointer. A press goes to
	// the tool, except the middle button (pan), two fingers (pinch to zoom and pan) and the wheel
	// (pan; with Ctrl, Cmd or Alt, zoom round the pointer). The canvas is drawn at the screen's
	// density, at most once a frame, whenever the drawing or the view changes.
	let { studio, tools }: { studio: Studio; tools: Record<ToolId, Tool> } = $props();

	const tool = $derived(tools[studio.tool]);

	let box = $state<HTMLElement>();
	let canvas = $state<HTMLCanvasElement>();
	let probe = $state<HTMLElement>();
	let editor = $state<ReturnType<typeof TextEditor>>();
	let renderer: Renderer | null = null;
	let rect = { left: 0, top: 0 };
	let fitted = false;

	// ---- Drawing -------------------------------------------------------------------------------------

	let frame = 0;
	function schedule() {
		if (!frame) frame = requestAnimationFrame(draw);
	}

	function draw() {
		frame = 0;
		if (!renderer || !probe) return;
		const shadow = getComputedStyle(probe).color;
		renderer.draw(
			{
				doc: studio.doc,
				paint: studio.paint,
				sketch: studio.sketch ? { layerId: studio.activeLayerId, shape: studio.sketch } : null
			},
			studio.view,
			shadow
		);
	}

	$effect(() => {
		// Everything the picture depends on.
		void [
			studio.doc,
			studio.view,
			studio.sketch,
			studio.paintTick,
			studio.activeLayerId,
			studio.stage
		];
		schedule();
	});

	onMount(() => {
		if (!box || !canvas) return;
		renderer = new Renderer(canvas);
		const observer = new ResizeObserver(() => resize());
		observer.observe(box);
		resize();
		box.addEventListener('wheel', wheel, { passive: false });
		// The theme changes the artboard's shadow.
		const themes = new MutationObserver(schedule);
		themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		const scheme = matchMedia('(prefers-color-scheme: dark)');
		scheme.addEventListener('change', schedule);
		return () => {
			observer.disconnect();
			themes.disconnect();
			scheme.removeEventListener('change', schedule);
			box?.removeEventListener('wheel', wheel);
			cancelAnimationFrame(frame);
			renderer = null;
		};
	});

	function resize() {
		if (!box || !renderer) return;
		const bounds = box.getBoundingClientRect();
		rect = { left: bounds.left, top: bounds.top };
		const width = Math.round(bounds.width);
		const height = Math.round(bounds.height);
		if (!width || !height) return;
		const before = studio.stage;
		renderer.resize(width, height, devicePixelRatio || 1);
		studio.stage = { width, height };
		if (!fitted) {
			fitted = true;
			studio.fit();
		} else if (before.width && before.height) {
			// Keep what was in the middle in the middle.
			studio.pan((width - before.width) / 2, (height - before.height) / 2);
		}
		schedule();
	}

	// ---- The pointer ---------------------------------------------------------------------------------

	/** The pointer driving the tool. */
	let active: number | null = null;
	/** The tool that took the press: it sees the drag through even if the tool changes (Space let go). */
	let driving: Tool | null = null;
	/** The middle button's pan. */
	let panning = $state.raw<{ id: number; x: number; y: number } | null>(null);
	/** Fingers on the stage, for a pinch. */
	let fingers: Record<number, { x: number; y: number }> = {};
	let pinch: { distance: number; x: number; y: number } | null = null;
	/** The last press, sent again when a modifier key changes so the tool can show it. */
	let last: { press: Press; pressed: boolean } | null = null;

	function pressOf(
		event: PointerEvent | MouseEvent,
		modifiers?: { shift: boolean; alt: boolean; mod: boolean }
	): Press {
		const sx = event.clientX - rect.left;
		const sy = event.clientY - rect.top;
		const point = studio.toDrawing(sx, sy);
		const pointer = 'pointerType' in event ? (event.pointerType as Press['pointer']) : 'mouse';
		const pressure = 'pressure' in event && pointer !== 'mouse' ? event.pressure || 0.5 : 1;
		return {
			x: point.x,
			y: point.y,
			sx,
			sy,
			pressure,
			tiltX: 'tiltX' in event ? event.tiltX : 0,
			tiltY: 'tiltY' in event ? event.tiltY : 0,
			pointer: pointer === 'pen' || pointer === 'touch' ? pointer : 'mouse',
			shift: modifiers?.shift ?? event.shiftKey,
			alt: modifiers?.alt ?? event.altKey,
			mod: modifiers?.mod ?? (event.ctrlKey || event.metaKey),
			time: event.timeStamp
		};
	}

	const fingerCount = () => Object.keys(fingers).length;

	function pinchState() {
		const [a, b] = Object.values(fingers);
		return { distance: Math.hypot(b.x - a.x, b.y - a.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	}

	/** Typing began with that press: the keyboard goes to it now, while the press is still on. */
	function startTyping(before: unknown) {
		if (!studio.typing || studio.typing === before) return;
		flushSync();
		editor?.focus();
	}

	function down(event: PointerEvent) {
		if (!box) return;
		const bounds = box.getBoundingClientRect();
		rect = { left: bounds.left, top: bounds.top };
		const typing = studio.typing;
		// Keyboard shortcuts belong to the drawing again once it's pressed. (Text being typed is
		// finished as its box loses the keyboard.)
		if (document.activeElement instanceof HTMLElement && document.activeElement !== box) {
			document.activeElement.blur();
		}
		studio.endTyping();
		box.focus({ preventScroll: true });
		event.preventDefault();
		// With the text tool, a press away from the text being typed only finishes it.
		if (typing && studio.tool === 'text' && event.button === 0) {
			studio.toolId = 'select';
			return;
		}

		if (event.pointerType === 'touch') {
			fingers[event.pointerId] = { x: event.clientX - rect.left, y: event.clientY - rect.top };
			if (fingerCount() === 2) {
				// A second finger: whatever the first began becomes a pinch.
				if (active !== null) {
					driving?.cancel();
					active = null;
					driving = null;
				}
				pinch = pinchState();
				return;
			}
			if (fingerCount() > 2) return;
		}
		// The middle button pans with any tool. (Space held is the hand tool itself: see heldTool.)
		if (event.button === 1) {
			box.setPointerCapture(event.pointerId);
			panning = { id: event.pointerId, x: event.clientX, y: event.clientY };
			return;
		}
		if (event.button !== 0 || active !== null) return;
		box.setPointerCapture(event.pointerId);
		active = event.pointerId;
		driving = tool;
		const press = pressOf(event);
		last = { press, pressed: true };
		const before = studio.typing;
		driving.down(press);
		startTyping(before);
	}

	function move(event: PointerEvent) {
		if (event.pointerType === 'touch' && fingers[event.pointerId]) {
			fingers[event.pointerId] = { x: event.clientX - rect.left, y: event.clientY - rect.top };
			if (pinch && fingerCount() >= 2) {
				const next = pinchState();
				studio.pan(next.x - pinch.x, next.y - pinch.y);
				if (pinch.distance > 0) studio.zoomBy(next.distance / pinch.distance, next.x, next.y);
				pinch = next;
				return;
			}
		}
		if (panning?.id === event.pointerId) {
			studio.pan(event.clientX - panning.x, event.clientY - panning.y);
			panning = { ...panning, x: event.clientX, y: event.clientY };
			return;
		}
		if (active === event.pointerId) {
			const coalesced = event.getCoalescedEvents?.() ?? [];
			const steps = (coalesced.length ? coalesced : [event]).map((step) => pressOf(step));
			const press = steps[steps.length - 1];
			last = { press, pressed: true };
			(driving ?? tool).move(press, true, steps);
			return;
		}
		if (active === null && !pinch && event.pointerType !== 'touch') {
			const press = pressOf(event);
			last = { press, pressed: false };
			tool.move(press, false, []);
		}
	}

	function up(event: PointerEvent) {
		if (event.pointerType === 'touch') {
			delete fingers[event.pointerId];
			if (fingerCount() < 2) pinch = null;
		}
		if (panning?.id === event.pointerId) {
			panning = null;
			return;
		}
		if (active !== event.pointerId) return;
		const owner = driving ?? tool;
		active = null;
		driving = null;
		const press = pressOf(event);
		last = { press, pressed: false };
		if (event.type === 'pointercancel') owner.cancel();
		else owner.up(press);
	}

	function leave(event: PointerEvent) {
		if (active === null && event.pointerType !== 'touch') {
			studio.hoverId = null;
			last = null;
		}
	}

	function double(event: MouseEvent) {
		if (event.button !== 0) return;
		const before = studio.typing;
		tool.double?.(pressOf(event));
		startTyping(before);
	}

	function wheel(event: WheelEvent) {
		event.preventDefault();
		const sx = event.clientX - rect.left;
		const sy = event.clientY - rect.top;
		const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
		if (event.ctrlKey || event.metaKey || event.altKey) {
			// A mouse wheel's notch is about 100; a trackpad pinch sends many small steps.
			const delta = event.deltaY * scale;
			const factor = Math.pow(
				2,
				-Math.max(-120, Math.min(120, delta)) / (Math.abs(delta) >= 50 ? 300 : 120)
			);
			studio.zoomBy(factor, sx, sy);
			return;
		}
		const sideways = event.shiftKey && !event.deltaX;
		studio.pan(
			-(sideways ? event.deltaY : event.deltaX) * scale,
			-(sideways ? 0 : event.deltaY) * scale
		);
	}

	/** A modifier key went down or up: the tool may change its cursor or its drag. */
	export function modifiers(event: KeyboardEvent) {
		if (!last) return;
		const press = {
			...last.press,
			shift: event.shiftKey,
			alt: event.altKey,
			mod: event.ctrlKey || event.metaKey
		};
		last = { ...last, press };
		(driving ?? tool).move(press, last.pressed && active !== null, []);
	}

	/** Whether a drag is under way (keys that would change the drawing wait for it). */
	export const busy = () => active !== null || panning !== null;
</script>

<div
	bind:this={box}
	class="stage"
	role="application"
	aria-label="Drawing. Use the tools to draw; arrow keys move what's selected."
	tabindex="-1"
	style:cursor={panning ? 'grabbing' : tool.cursor}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	onpointerleave={leave}
	ondblclick={double}
	oncontextmenu={(event) => event.preventDefault()}
>
	<canvas bind:this={canvas}></canvas>
	<Overlay chrome={tool.chrome} />
	<TextEditor bind:this={editor} {studio} />
	<span bind:this={probe} class="probe" aria-hidden="true"></span>
</div>

<style>
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--studio-desk);
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		outline: none;
	}

	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	/* Holds the artboard's shadow colour for the canvas to read. */
	.probe {
		position: absolute;
		width: 0;
		height: 0;
		color: var(--studio-shadow);
	}
</style>
