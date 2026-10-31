<script lang="ts">
	import type { Snippet } from 'svelte';

	// A small panel for a toolbar button (colours, the first letter), shown in the top layer under
	// its button. The button is the parent's: <button popovertarget={id}>.
	let {
		id,
		width = 240,
		label,
		children
	}: {
		id: string;
		width?: number;
		label: string;
		children: Snippet<[close: () => void]>;
	} = $props();

	let panel = $state<HTMLElement>();

	function place(event: ToggleEvent) {
		if (event.newState !== 'open' || !panel) return;
		const trigger = document.querySelector(`[popovertarget="${id}"]`);
		if (!trigger) return;
		const box = trigger.getBoundingClientRect();
		const below = box.bottom + 6;
		panel.style.top = `${below + 320 > innerHeight && box.top > 340 ? box.top - 6 - 320 : below}px`;
		panel.style.left = `${Math.max(8, Math.min(box.left, innerWidth - width - 8))}px`;
	}

	const close = () => panel?.hidePopover();
</script>

<div
	bind:this={panel}
	{id}
	class="menu"
	popover="auto"
	role="dialog"
	aria-label={label}
	style:width="{width}px"
	onbeforetoggle={place}
>
	{@render children(close)}
</div>

<style>
	.menu {
		position: fixed;
		inset: auto;
		max-height: 320px;
		margin: 0;
		padding: 14px;
		overflow: auto;
		border: 1px solid var(--bb-line-control);
		border-radius: 14px;
		background: var(--bb-ink);
		color: var(--bb-text);
		box-shadow: 0 24px 48px -20px var(--bb-drop);
		font-family: var(--font-ui);
		font-style: normal;
		text-indent: 0;
		line-height: 1.4;
	}
</style>
