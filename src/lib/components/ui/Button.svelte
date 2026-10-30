<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Variant = 'primary' | 'ghost' | 'danger' | 'quiet';
	// md = 44px (default touch target), lg = 48px, xl = 54px for large CTAs.
	type Size = 'md' | 'lg' | 'xl';

	type Common = {
		variant?: Variant;
		size?: Size;
		/** Full-width button. */
		block?: boolean;
		/** Royal glow under primary CTAs. */
		glow?: boolean;
		children: Snippet;
	};

	type Props = Common &
		(
			| (Omit<HTMLAnchorAttributes, 'children'> & { href: string })
			| (Omit<HTMLButtonAttributes, 'children'> & { href?: undefined })
		);

	let {
		variant = 'ghost',
		size = 'md',
		block = false,
		glow = false,
		children,
		href,
		class: className,
		...rest
	}: Props = $props();

	const classes = $derived(['btn', variant, size, { block, glow }, className]);
	const disabled = $derived(href === undefined && !!(rest as HTMLButtonAttributes).disabled);
</script>

<!-- motion-press gives the tactile shrink-and-spring on click. -->
<motion-press class={['press', { block }]} scale={0.96} disabled={disabled || undefined}>
	{#if href !== undefined}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass resolve()d or external URLs -->
		<a {href} class={classes} {...rest as HTMLAnchorAttributes}>{@render children()}</a>
	{:else}
		<button type="button" class={classes} {...rest as HTMLButtonAttributes}
			>{@render children()}</button
		>
	{/if}
</motion-press>

<style>
	.press {
		display: inline-flex;
		vertical-align: middle;
	}

	.press.block {
		display: flex;
		width: 100%;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 11px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--bb-text);
		font: 600 15px/1.2 var(--font-ui);
		text-decoration: none;
		white-space: nowrap;
		transition:
			background-color 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.lg {
		min-height: 48px;
		padding: 0 20px;
		border-radius: var(--r-control);
		font-size: 16px;
	}

	.xl {
		min-height: 54px;
		padding: 0 24px;
		border-radius: var(--r-control);
		font-size: 16px;
	}

	.block {
		display: flex;
		width: 100%;
	}

	.primary {
		background: var(--bb-royal);
		color: #fff;
		font-weight: 700;
	}

	.primary:hover {
		background: var(--bb-royal-hover);
		color: #fff;
	}

	.glow {
		box-shadow: var(--shadow-primary);
	}

	.ghost {
		border-color: var(--bb-line-control);
	}

	.ghost:hover,
	.quiet:hover {
		background: var(--bb-line-faint);
		color: var(--bb-text);
	}

	.quiet {
		color: var(--bb-text-label);
	}

	.danger {
		border-color: var(--bb-coral-line);
		color: var(--bb-coral);
	}

	.danger:hover {
		background: var(--bb-coral-wash);
		color: var(--bb-coral);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn:disabled:hover {
		background: transparent;
	}

	.primary:disabled:hover {
		background: var(--bb-royal);
	}
</style>
