<script lang="ts">
	import { getTheme } from '$lib/theme.svelte';
	import Icon from './Icon.svelte';

	// Light/dark switch for the headers: a moon while dark, a sun while light. The new theme
	// spreads out from the button (see ThemeState.toggle).
	const theme = getTheme();
	const dark = $derived(theme.current === 'dark');
	// The icon draws itself in after a switch, not when the page loads.
	let switched = $state(false);

	function onclick(event: MouseEvent) {
		switched = true;
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		theme.toggle({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
	}
</script>

<button
	type="button"
	class="theme-toggle"
	aria-label="Dark theme"
	aria-pressed={dark}
	title={dark ? 'Switch to the light theme' : 'Switch to the dark theme'}
	{onclick}
>
	{#key dark}
		{#if switched}
			<motion-icon animation="draw rotate" trigger="mount" duration={0.6}>
				{@render icon()}
			</motion-icon>
		{:else}
			{@render icon()}
		{/if}
	{/key}
</button>

{#snippet icon()}
	<Icon name={dark ? 'moon' : 'sun'} size={19} strokeWidth={1.9} />
{/snippet}

<style>
	.theme-toggle {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-label);
	}

	.theme-toggle:hover {
		background: var(--bb-line-faint);
		color: var(--bb-text-strong);
	}

	motion-icon {
		--mc-icon-size: 19px;
		display: grid;
	}
</style>
