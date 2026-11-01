<script lang="ts">
	import { ENTRY_COPY, type MentionChoice } from '$lib/bible';
	import { capitalize, createEntry } from '$lib/library';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { MentionMenuProps, MentionRow } from './mention';

	// The list that opens when the writer types @. Focus stays in the editor, so the keys come here
	// through keydown(), and it sits in the top layer so that it shows over focus mode and isn't
	// clipped by the page. A name nobody has yet can be added from here without leaving the text.
	let { bookId }: { bookId: number } = $props();

	let panel = $state<HTMLElement>();
	let suggestion = $state.raw<MentionMenuProps | null>(null);
	let active = $state(0);
	let adding = $state(false);
	let error = $state('');

	const rows = $derived<MentionRow[]>(suggestion?.items ?? []);
	const listId = $props.id();

	/** What sets a row apart: whose short name it is, or what it is, and where it's from. */
	const rowNote = (row: MentionChoice) =>
		[
			row.label === row.name ? capitalize(ENTRY_COPY[row.type].one) : row.name,
			row.elsewhere ? 'from another book' : ''
		]
			.filter(Boolean)
			.join(' · ');

	const rowLabel = (row: MentionRow) =>
		row.add
			? `Add “${row.label}” as a new ${ENTRY_COPY[row.add].one}`
			: row.label === row.name
				? `${row.name}, ${ENTRY_COPY[row.type].one}`
				: `${row.label}, for ${row.name}`;

	/** Open or follow the query: the plugin calls this on every change while @ is active. */
	export function open(props: MentionMenuProps) {
		if (!suggestion || props.query !== suggestion.query) active = 0;
		suggestion = props;
		error = '';
	}

	export function close() {
		suggestion = null;
		adding = false;
		if (panel?.matches(':popover-open')) panel.hidePopover();
	}

	/** Handle a key while the menu is open. True means the editor should ignore it. */
	export function keydown(event: KeyboardEvent) {
		if (!suggestion || rows.length === 0) return false;
		if (event.key === 'ArrowDown') active = (active + 1) % rows.length;
		else if (event.key === 'ArrowUp') active = (active - 1 + rows.length) % rows.length;
		else if (event.key === 'Enter' || event.key === 'Tab') pick(rows[active]);
		else return false;
		return true;
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

	async function pick(row: MentionRow | undefined) {
		if (!row || adding) return;
		if (!row.add) {
			suggestion?.command(row);
			return;
		}
		adding = true;
		try {
			const entry = await createEntry(row.add, row.label, bookId);
			const choice: MentionChoice = {
				type: row.add,
				id: entry.id,
				name: entry.name,
				label: entry.name,
				elsewhere: false
			};
			// Whatever has been typed since goes with it, and if the menu closed, nothing is inserted.
			suggestion?.command(choice);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "Couldn't add that.";
		} finally {
			adding = false;
		}
	}

	// After the editor has settled: focus mode's typewriter scrolls the line as it types, and the
	// rows change the panel's height.
	$effect(() => {
		void rows;
		void error;
		if (suggestion) requestAnimationFrame(place);
	});
</script>

<div bind:this={panel} class="menu" popover="manual" data-mention-menu>
	{#if rows.length > 0}
		<ul id={listId} role="listbox" aria-label="Mention from the story bible">
			{#each rows as row, index (row.add ? `add-${row.add}` : `${row.type}-${row.id}-${row.label}`)}
				<li role="option" aria-selected={index === active}>
					<!-- Mouse down, not click: focus has to stay in the editor. -->
					<button
						type="button"
						tabindex="-1"
						class={['row', { active: index === active, add: !!row.add }]}
						onmousemove={(event) => {
							// Only a pointer that really moved: the menu opening under a resting one
							// mustn't change what Enter picks.
							if (event.movementX || event.movementY) active = index;
						}}
						onmousedown={(event) => {
							event.preventDefault();
							pick(row);
						}}
					>
						<Icon
							name={row.add ? 'plus' : ENTRY_COPY[row.type].icon}
							size={16}
							strokeWidth={row.add ? 2.2 : 2}
						/>
						{#if row.add}
							<span class="name">Add as a {ENTRY_COPY[row.add].one}</span>
						{:else}
							<span class="name">{row.label}</span>
							<span class="note">{rowNote(row)}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">Nothing in the story bible yet. Type a name to add it.</p>
	{/if}
	{#if error}
		<p class="error" role="alert"><Icon name="alert-circle" size={15} />{error}</p>
	{/if}
	<p class="sr-only" aria-live="polite">{rows[active] ? rowLabel(rows[active]) : ''}</p>
</div>

<style>
	.menu {
		position: fixed;
		inset: auto;
		width: min(320px, calc(100vw - 16px));
		max-height: min(340px, 60vh);
		margin: 0;
		padding: 6px;
		overflow: auto;
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

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: grid;
		grid-template-columns: 18px minmax(0, 1fr);
		align-items: center;
		column-gap: 10px;
		width: 100%;
		min-height: 44px;
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
		overflow-wrap: anywhere;
	}

	.row.add .name {
		color: var(--bb-sky);
		font-weight: 600;
	}

	.note {
		grid-column: 2;
		font-size: 12.5px;
		color: var(--bb-text-3);
	}

	.empty {
		padding: 10px;
		font-size: 14px;
		color: var(--bb-text-3);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		font-size: 13.5px;
		color: var(--bb-coral-soft);
	}
</style>
