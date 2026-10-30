<script lang="ts">
	import { resolve } from '$app/paths';
	import { showMenuStore } from '$lib/stores';
	import { getAppHeader } from '$lib/app-header.svelte';
	import Wordmark from './Wordmark.svelte';
	import Kbd from './Kbd.svelte';
	import Icon from './Icon.svelte';

	let { user }: { user: { name: string } } = $props();

	const header = getAppHeader();
	const initial = $derived(user.name?.trim().charAt(0).toUpperCase() || '?');
</script>

<header class="app-header">
	<div class="inner" class:wide={header.wide}>
		<div class="start">
			<a class="brand" href={resolve('/')}>
				<Wordmark size={23} iconSize={28} />
			</a>
			{#if header.crumbs.length > 0}
				<nav aria-label="Breadcrumb" class="crumbs">
					<ol>
						{#each header.crumbs as crumb, i (i)}
							<li>
								{#if crumb.href}
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- crumbs are built with resolve() -->
									<a href={crumb.href}>{crumb.label}</a>
								{:else}
									<span aria-current="page">{crumb.label}</span>
								{/if}
							</li>
						{/each}
					</ol>
				</nav>
			{/if}
		</div>

		<div class="end">
			{#if header.actions}
				{@render header.actions()}
			{:else}
				<button
					type="button"
					class="create-hint"
					aria-pressed={$showMenuStore}
					onclick={() => showMenuStore.update((open) => !open)}
				>
					<span class="hint-kbd"><Kbd mod key="M" size="sm" /></span>
					<span class="hint-plus"><Icon name="plus" size={16} /></span>
					Create
				</button>
				<a class="logout" href={resolve('/logout')} data-sveltekit-reload>Log out</a>
				<span class="avatar" role="img" aria-label="Signed in as {user.name}">{initial}</span>
			{/if}
		</div>
	</div>
</header>

<style>
	.app-header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: rgba(10, 15, 36, 0.9);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--bb-line-faint);
	}

	.inner {
		max-width: 1280px;
		margin: 0 auto;
		padding: 12px 32px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px 24px;
	}

	.inner.wide {
		max-width: 1360px;
	}

	.start {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 22px;
		min-width: 0;
	}

	.brand {
		display: inline-flex;
		text-decoration: none;
		border-radius: 8px;
	}

	.crumbs {
		min-width: 0;
		padding-left: 22px;
		border-left: 1px solid #222d5a;
		font-size: 14px;
		color: var(--bb-text-3);
	}

	.crumbs ol {
		display: flex;
		flex-wrap: wrap;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.crumbs li {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.crumbs li + li::before {
		content: '/';
		padding: 0 8px;
	}

	.crumbs a {
		color: var(--bb-text-2);
		text-decoration: none;
	}

	.crumbs a:hover {
		color: var(--bb-text);
	}

	.crumbs [aria-current='page'] {
		color: var(--bb-text);
	}

	.end {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.create-hint {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 10px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
		font: 400 13px var(--font-ui);
	}

	.create-hint:hover,
	.create-hint[aria-pressed='true'] {
		color: var(--bb-text-label);
	}

	.hint-kbd {
		display: contents;
	}

	.hint-plus {
		display: none;
	}

	.logout {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 14px;
		border-radius: 10px;
		color: var(--bb-text-label);
		text-decoration: none;
		font-weight: 600;
		font-size: 14.5px;
	}

	.logout:hover {
		background: var(--bb-line-faint);
		color: var(--bb-text-label);
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--bb-paper);
		color: #141c45;
		font-family: var(--font-display);
		font-size: 16px;
	}

	@media (max-width: 600px) {
		.inner {
			padding: 10px 16px;
		}

		.crumbs {
			padding-left: 0;
			border-left: none;
		}

		/* No keyboard shortcut on phones: show a plain "+ Create" toggle instead. */
		.hint-kbd {
			display: none;
		}

		.hint-plus {
			display: contents;
		}

		.create-hint {
			padding: 0 8px;
			font-weight: 600;
			color: var(--bb-text-label);
		}
	}
</style>
