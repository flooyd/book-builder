<script lang="ts">
	import { resolve } from '$app/paths';
	import { ENTRY_COPY, isEntryType, type EntryType } from '$lib/bible';
	import { capitalize } from '$lib/library';
	import { entryStores, type Entry } from '$lib/stores';
	import { get } from 'svelte/store';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichText from './RichText.svelte';

	// The writer's card for a mention: who or what it is, without leaving the sentence. It shows on
	// hover (or a tap), stays while the pointer is on it, and goes as soon as the writer types.
	// Only the editor has it: readers see a mention as plain words.

	const SHOW_AFTER = 260;
	const HIDE_AFTER = 180;
	const MOST_DETAILS = 3;

	let panel = $state<HTMLElement>();
	let card = $state.raw<{ type: EntryType; entry: Entry } | null>(null);
	let showing: ReturnType<typeof setTimeout> | undefined;
	let hiding: ReturnType<typeof setTimeout> | undefined;

	const overline = $derived(
		card && 'kind' in card.entry && card.entry.kind
			? card.entry.kind
			: card
				? capitalize(ENTRY_COPY[card.type].one)
				: ''
	);
	const details = $derived(card?.entry.details.filter((d) => d.value).slice(0, MOST_DETAILS) ?? []);
	// A new tab: the card opens over text that may not be saved yet, and focus mode stays put.
	const href = $derived(
		card ? resolve('/bible/[type]/[id]', { type: card.type, id: String(card.entry.id) }) : ''
	);

	function find(element: HTMLElement) {
		const type = element.dataset.entry;
		if (!isEntryType(type)) return null;
		const entry = get(entryStores[type]).find((e) => e.id === Number(element.dataset.id));
		return entry ? { type, entry } : null;
	}

	function place(element: HTMLElement) {
		if (!panel) return;
		if (!panel.matches(':popover-open')) panel.showPopover();
		const gap = 8;
		const rect = element.getBoundingClientRect();
		const box = panel.getBoundingClientRect();
		const below = rect.bottom + gap;
		const height = window.visualViewport?.height ?? innerHeight;
		panel.style.top = `${below + box.height <= height - gap ? below : Math.max(gap, rect.top - gap - box.height)}px`;
		panel.style.left = `${Math.max(gap, Math.min(rect.left, innerWidth - box.width - gap))}px`;
	}

	/** Show the card for a mention in the text, in a moment or (a tap) at once. */
	export function show(element: HTMLElement, now = false) {
		clearTimeout(showing);
		clearTimeout(hiding);
		// The menu is open: it's the thing to look at.
		if (document.querySelector('[data-mention-menu]:popover-open')) return;
		const open = () => {
			card = find(element);
			if (!card) return hide();
			requestAnimationFrame(() => place(element));
		};
		if (now) open();
		else showing = setTimeout(open, SHOW_AFTER);
	}

	/** The pointer left the mention: go, unless it's on its way to the card. */
	export function leave() {
		clearTimeout(showing);
		hiding = setTimeout(hide, HIDE_AFTER);
	}

	export function hide() {
		clearTimeout(showing);
		clearTimeout(hiding);
		card = null;
		if (panel?.matches(':popover-open')) panel.hidePopover();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={panel}
	class="card"
	popover="manual"
	onmouseenter={() => clearTimeout(hiding)}
	onmouseleave={leave}
>
	{#if card}
		<p class="overline">{overline}</p>
		<p class="name">{card.entry.name}</p>
		{#if card.entry.aliases.length > 0}
			<p class="aliases">Also {card.entry.aliases.join(', ')}</p>
		{/if}
		{#if card.entry.description}
			<p class="description"><RichText value={card.entry.description} italic /></p>
		{/if}
		{#if details.length > 0}
			<dl>
				{#each details as detail, index (index)}
					<div>
						<dt>{detail.label}</dt>
						<dd>{detail.value}</dd>
					</div>
				{/each}
			</dl>
		{/if}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is resolve()d -->
		<a {href} target="_blank" rel="noopener">
			Open in the story bible<Icon name="arrow-right" size={15} />
		</a>
	{/if}
</div>

<style>
	.card {
		position: fixed;
		inset: auto;
		width: min(320px, calc(100vw - 16px));
		max-height: min(380px, 70vh);
		margin: 0;
		padding: 16px;
		overflow: auto;
		border: 1px solid var(--bb-line-control);
		border-radius: 16px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font-family: var(--font-ui);
		font-size: 14.5px;
		font-style: normal;
		font-weight: 400;
		line-height: 1.45;
		text-indent: 0;
		text-align: left;
	}

	/* Open with content only: an empty popover would flash a box. */
	.card:popover-open {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.overline {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.name {
		font-family: var(--font-display);
		font-size: 22px;
		line-height: 1.15;
		color: var(--bb-text-strong);
		overflow-wrap: anywhere;
	}

	.aliases {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.description {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 16px;
		color: var(--bb-text-2);
	}

	dl {
		margin: 4px 0 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	dl div {
		display: flex;
		gap: 8px;
	}

	dt {
		flex: none;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
		color: var(--bb-text-2);
	}

	a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 6px;
		min-height: 32px;
		color: var(--bb-sky);
		font-weight: 600;
		font-size: 13.5px;
		text-decoration: none;
	}

	a:hover {
		color: var(--bb-sky-hover);
	}
</style>
