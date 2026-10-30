<script lang="ts">
	import { fly } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { modalStore, type ModalCategory } from '$lib/stores';
	import Icon, { type IconName } from './Icon.svelte';
	import Kbd from './Kbd.svelte';

	const items: { category: ModalCategory; label: string; icon: IconName }[] = [
		{ category: 'book', label: 'Book', icon: 'book' },
		{ category: 'part', label: 'Part', icon: 'layers' },
		{ category: 'chapter', label: 'Chapter', icon: 'file-text' },
		{ category: 'character', label: 'Character', icon: 'users' },
		{ category: 'system', label: 'System', icon: 'share-2' }
	];

	// Flies up when opened (Ctrl/Cmd+M); no movement for reduced-motion users.
	const reduced =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const flyIn = { y: 32, duration: reduced ? 0 : 420, easing: backOut };
	const flyOut = { y: 24, duration: reduced ? 0 : 180 };

	// Toolbar pattern: one tab stop, arrow keys move between items.
	let active = $state(0);
	let buttons: HTMLButtonElement[] = $state([]);

	function onkeydown(event: KeyboardEvent) {
		const last = items.length - 1;
		const next =
			event.key === 'ArrowRight'
				? (active + 1) % items.length
				: event.key === 'ArrowLeft'
					? (active - 1 + items.length) % items.length
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null;
		if (next === null) return;
		event.preventDefault();
		active = next;
		buttons[next]?.focus();
	}
</script>

<div class="dock-wrap">
	<div
		class="dock"
		role="toolbar"
		aria-label="Create"
		tabindex={-1}
		{onkeydown}
		in:fly={flyIn}
		out:fly={flyOut}
	>
		<span class="dock-label">New<Kbd mod key="M" size="xs" tone="sunken" /></span>
		{#each items as item, i (item.category)}
			<motion-press scale={0.92}>
				<button
					type="button"
					class="dock-item"
					class:primary={i === 0}
					tabindex={i === active ? 0 : -1}
					bind:this={buttons[i]}
					onfocus={() => (active = i)}
					onclick={() => modalStore.set({ type: 'create', category: item.category })}
				>
					<Icon name={item.icon} size={16} />{item.label}
				</button>
			</motion-press>
		{/each}
	</div>
</div>

<style>
	.dock-wrap {
		position: sticky;
		bottom: 22px;
		z-index: 20;
		display: flex;
		justify-content: center;
		padding: 48px 16px 40px;
		pointer-events: none;
	}

	.dock {
		pointer-events: auto;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 4px;
		padding: 7px;
		border-radius: 18px;
		background: rgba(20, 28, 62, 0.96);
		border: 1px solid var(--bb-line-control);
		box-shadow:
			0 30px 60px -18px rgba(0, 0, 0, 0.95),
			0 0 0 6px rgba(10, 15, 36, 0.6);
	}

	.dock:focus {
		outline: none;
		box-shadow:
			0 30px 60px -18px rgba(0, 0, 0, 0.95),
			0 0 0 6px rgba(10, 15, 36, 0.6);
	}

	.dock-label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 0 12px 0 10px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.dock-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 14px;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--bb-text);
		font: 600 14.5px var(--font-ui);
	}

	.dock-item :global(svg) {
		color: var(--bb-sky);
	}

	.dock-item:hover {
		background: #1f2b5c;
	}

	.dock-item.primary {
		background: var(--bb-royal);
		color: #fff;
		font-weight: 700;
	}

	.dock-item.primary :global(svg) {
		color: currentColor;
	}

	.dock-item.primary:hover {
		background: var(--bb-royal-hover);
	}

	/* Phones: icon over label so all five fit on one row. */
	@media (max-width: 600px) {
		.dock {
			flex-wrap: nowrap;
			gap: 2px;
			padding: 5px;
		}

		.dock-label {
			display: none;
		}

		.dock-item {
			flex-direction: column;
			gap: 3px;
			min-height: 52px;
			padding: 6px 8px;
			font-size: 11.5px;
		}
	}
</style>
