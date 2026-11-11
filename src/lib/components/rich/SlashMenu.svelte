<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { INSERT_KEYS, type InsertItem } from './insert';
	import type { SlashMenuProps } from './slash';

	// The Insert list, opened by typing / at the start of an empty line (see ./slash.ts). Focus stays
	// in the editor, so keys come here through keydown(). Like the mention menu it's a popover in the
	// top layer, mounted inside the editor, so it shows over focus mode and isn't clipped.
	let panel = $state<HTMLElement>();
	let suggestion = $state.raw<SlashMenuProps | null>(null);
	let active = $state(0);

	const rows = $derived<InsertItem[]>(suggestion?.items ?? []);
	const listId = $props.id();

	export function open(props: SlashMenuProps) {
		if (!suggestion) active = 0;
		suggestion = props;
		requestAnimationFrame(place);
	}

	export function close() {
		suggestion = null;
		if (panel?.matches(':popover-open')) panel.hidePopover();
	}

	/** Handle a key while the list is open. True means the editor should ignore it. */
	export function keydown(event: KeyboardEvent) {
		if (!suggestion || rows.length === 0) return false;
		if (event.key === 'ArrowDown') active = (active + 1) % rows.length;
		else if (event.key === 'ArrowUp') active = (active - 1 + rows.length) % rows.length;
		else if (event.key === 'Enter' || event.key === 'Tab') pick(rows[active]);
		else return false;
		return true;
	}

	function pick(row: InsertItem | undefined) {
		if (row) suggestion?.command(row);
	}

	function place() {
		if (!panel || !suggestion) return;
		const rect = suggestion.clientRect?.();
		if (!rect) return;
		if (!panel.matches(':popover-open')) panel.showPopover();
		const gap = 8;
		// The keyboard on a phone shrinks the visual viewport, not the window.
		const height = window.visualViewport?.height ?? innerHeight;
		const box = panel.getBoundingClientRect();
		const below = rect.bottom + gap;
		const fits = below + box.height <= height - gap;
		panel.style.top = `${fits ? below : Math.max(gap, rect.top - gap - box.height)}px`;
		panel.style.left = `${Math.max(gap, Math.min(rect.left, innerWidth - box.width - gap))}px`;
	}
</script>

<div bind:this={panel} class="menu" popover="manual" data-slash-menu>
	<p class="title">Insert</p>
	<ul id={listId} role="listbox" aria-label="Insert">
		{#each rows as row, index (row.id)}
			<li role="option" aria-selected={index === active}>
				<!-- Mouse down, not click: focus has to stay in the editor. -->
				<button
					type="button"
					tabindex="-1"
					class={['row', { active: index === active }]}
					onmousemove={(event) => {
						if (event.movementX || event.movementY) active = index;
					}}
					onmousedown={(event) => {
						event.preventDefault();
						pick(row);
					}}
				>
					<Icon name={row.icon} size={17} />
					<span class="name">{row.label}</span>
					<span class="note">{row.note}</span>
					{#if INSERT_KEYS[row.id]}<kbd>{INSERT_KEYS[row.id]}</kbd>{/if}
				</button>
			</li>
		{/each}
	</ul>
	<p class="sr-only" aria-live="polite">
		{rows[active] ? `${rows[active].label}: ${rows[active].note}` : ''}
	</p>
</div>

<style>
	.menu {
		position: fixed;
		inset: auto;
		width: min(320px, calc(100vw - 16px));
		margin: 0;
		padding: 6px;
		border: 1px solid var(--bb-line-control);
		border-radius: 14px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font-family: var(--font-ui);
		font-style: normal;
		font-size: 15px;
		text-indent: 0;
		line-height: 1.35;
	}

	.title {
		margin: 4px 10px 4px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 10px;
		width: 100%;
		min-height: 48px;
		padding: 6px 10px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--bb-text-2);
		font: inherit;
		text-align: left;
	}

	.row.active {
		background: var(--bb-raised);
		color: var(--bb-text-strong);
	}

	.row :global(svg) {
		grid-row: 1 / span 2;
	}

	.name {
		font-weight: 600;
		color: var(--bb-text);
	}

	.note {
		grid-column: 2;
		font-size: 12.5px;
		color: var(--bb-text-3);
	}

	kbd {
		grid-column: 3;
		grid-row: 1 / span 2;
		padding: 2px 6px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 6px;
		font: 600 11px var(--font-ui);
		color: var(--bb-text-3);
	}

	/* Keys mean nothing on a touch screen. */
	@media (hover: none) {
		kbd {
			display: none;
		}
	}
</style>
