<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { Studio, ToolId } from '$lib/studio/studio.svelte';
	import { RAIL, SHAPE_TOOLS, TOOL_INFO } from '$lib/studio/tools';
	import ColorWell from './ColorWell.svelte';

	// The tools, in a rail down the left (a strip along the bottom on small screens), with the
	// shapes in one slot that shows the last one used, and below them the fill and stroke: the
	// selection's, or what new shapes get when nothing is selected. Buttons here don't take focus
	// from a mouse click, so Space still means the hand afterwards.
	let {
		studio,
		choose,
		across = false
	}: {
		studio: Studio;
		/** Picks a tool (putting the last one down properly). */
		choose: (id: ToolId) => void;
		/** Laid out across, for the small-screen strip. */
		across?: boolean;
	} = $props();

	let lastShape = $state<ToolId>('rect');
	$effect(() => {
		if (SHAPE_TOOLS.includes(studio.toolId)) lastShape = studio.toolId;
	});

	const flyout = `shapes-${Math.random().toString(36).slice(2, 8)}`;
	let panel = $state<HTMLElement>();
	let slot = $state<HTMLElement>();

	function placeFlyout(event: ToggleEvent) {
		if (event.newState !== 'open' || !panel || !slot) return;
		const box = slot.getBoundingClientRect();
		if (across) {
			panel.style.left = `${Math.max(8, Math.min(box.left, innerWidth - 220))}px`;
			panel.style.top = `${box.top - 8 - panel.offsetHeight}px`;
		} else {
			panel.style.left = `${box.right + 8}px`;
			panel.style.top = `${box.top - 6}px`;
		}
	}

	const keyOf = (id: ToolId) => TOOL_INFO[id].key;
	const titleOf = (id: ToolId) => `${TOOL_INFO[id].label}${keyOf(id) ? ` (${keyOf(id)})` : ''}`;
	const keep = (event: MouseEvent) => event.preventDefault();

	// The wells follow the selection when there is one.
	const first = $derived(studio.selected[0]?.shape ?? null);
	const fill = $derived(
		first && first.kind !== 'group' && first.kind !== 'line'
			? (first.fill?.color ?? null)
			: studio.style.fill
	);
	const stroke = $derived(
		first && first.kind !== 'group' ? (first.stroke?.paint.color ?? null) : studio.style.stroke
	);
	const remember = (color: string | null) => {
		if (color) studio.remember(color);
	};

	function swap() {
		const { fill: oldFill, stroke: oldStroke } = { fill, stroke };
		studio.setFill(oldStroke);
		studio.setStroke(oldFill);
	}
</script>

<div
	class="rail"
	class:across
	role="toolbar"
	aria-label="Tools"
	aria-orientation={across ? 'horizontal' : 'vertical'}
>
	<div class="tools">
		{#each RAIL as item (item)}
			{#if item === 'shapes'}
				{@const id = lastShape}
				<div class="slot" bind:this={slot}>
					<button
						type="button"
						class="tool"
						aria-pressed={SHAPE_TOOLS.includes(studio.tool)}
						aria-label={titleOf(id)}
						title={titleOf(id)}
						onmousedown={keep}
						onclick={() => choose(id)}
					>
						<Icon name={TOOL_INFO[id].icon} size={19} strokeWidth={1.8} />
					</button>
					<button
						type="button"
						class="more"
						popovertarget={flyout}
						aria-label="More shapes"
						title="More shapes"
						onmousedown={keep}
					>
						<svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true"
							><path d="M6 0v6H0z" fill="currentColor" /></svg
						>
					</button>
				</div>
			{:else}
				<button
					type="button"
					class="tool"
					aria-pressed={studio.tool === item}
					aria-label={titleOf(item)}
					title={titleOf(item)}
					onmousedown={keep}
					onclick={() => choose(item)}
				>
					<Icon name={TOOL_INFO[item].icon} size={19} strokeWidth={1.8} />
				</button>
			{/if}
		{/each}
	</div>

	<div class="colours">
		<div class="wells">
			<span class="fill-well">
				<ColorWell
					value={fill}
					label="Fill"
					side={across ? 'above' : 'right'}
					recent={studio.recent}
					size={26}
					onchange={(color) => studio.setFill(color, 'fill')}
					onclose={remember}
				/>
			</span>
			<span class="stroke-well">
				<ColorWell
					value={stroke}
					label="Stroke"
					stroke
					side={across ? 'above' : 'right'}
					recent={studio.recent}
					size={26}
					onchange={(color) => studio.setStroke(color, 'stroke')}
					onclose={remember}
				/>
			</span>
		</div>
		{#if !across}
			<button
				type="button"
				class="small"
				aria-label="Swap fill and stroke (X)"
				title="Swap fill and stroke (X)"
				onmousedown={keep}
				onclick={swap}
			>
				<Icon name="swap" size={14} />
			</button>
		{/if}
	</div>
</div>

<div
	bind:this={panel}
	id={flyout}
	class="flyout"
	popover="auto"
	role="menu"
	aria-label="Shapes"
	onbeforetoggle={placeFlyout}
>
	{#each SHAPE_TOOLS as id (id)}
		<button
			type="button"
			role="menuitemradio"
			aria-checked={studio.tool === id}
			class="flyout-item"
			onclick={() => {
				choose(id);
				panel?.hidePopover();
			}}
		>
			<Icon name={TOOL_INFO[id].icon} size={17} strokeWidth={1.8} />
			<span>{TOOL_INFO[id].label}</span>
			{#if keyOf(id)}<kbd>{keyOf(id)}</kbd>{/if}
		</button>
	{/each}
</div>

<style>
	.rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 100%;
		padding: 10px 0 14px;
	}

	.tools {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.across,
	.across .tools {
		flex-direction: row;
	}

	.across {
		height: auto;
		padding: 5px;
		gap: 6px;
	}

	.across .tool {
		width: 38px;
	}

	.tool {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--bb-text-label);
	}

	.tool:hover {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.tool[aria-pressed='true'] {
		background: var(--studio-accent);
		color: #fff;
	}

	.slot {
		position: relative;
	}

	.more {
		position: absolute;
		right: 1px;
		bottom: 1px;
		display: grid;
		place-items: end;
		width: 16px;
		height: 16px;
		padding: 3px;
		border: none;
		border-radius: 4px;
		background: none;
		color: var(--bb-text-3);
	}

	.slot:has(.tool[aria-pressed='true']) .more {
		color: #fff;
	}

	.colours {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.across .colours {
		flex-direction: row;
		padding-left: 6px;
		border-left: 1px solid var(--bb-line-soft);
	}

	.wells {
		position: relative;
		width: 40px;
		height: 40px;
	}

	.fill-well {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 1;
	}

	.stroke-well {
		position: absolute;
		right: 0;
		bottom: 0;
	}

	.small {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: none;
		border-radius: 7px;
		background: none;
		color: var(--bb-text-3);
	}

	.small:hover {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.flyout {
		position: fixed;
		inset: auto;
		width: 210px;
		margin: 0;
		padding: 6px;
		border: 1px solid var(--bb-line-control);
		border-radius: 12px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
	}

	.flyout-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 36px;
		padding: 0 10px;
		border: none;
		border-radius: 8px;
		background: none;
		color: var(--bb-text-label);
		font: 500 13.5px var(--font-ui);
		text-align: left;
	}

	.flyout-item:hover {
		background: var(--bb-hover);
		color: var(--bb-text-strong);
	}

	.flyout-item[aria-checked='true'] {
		color: var(--studio-accent);
	}

	.flyout-item span {
		flex: 1;
	}

	kbd {
		color: var(--bb-text-3);
		font: 600 11px var(--font-ui);
	}
</style>
