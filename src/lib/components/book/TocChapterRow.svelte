<script lang="ts">
	import { capitalize, relativeDay } from '$lib/library';

	// One chapter in a table of contents: number, title, dotted leader, relative date. The most
	// recently updated chapter gets the sky dot and highlight.
	let {
		href,
		number,
		title,
		updatedAt,
		latest = false,
		compact = false
	}: {
		href: string;
		number: number;
		title: string;
		updatedAt: string;
		latest?: boolean;
		/** Narrow number column, for lists without part overlines beside them. */
		compact?: boolean;
	} = $props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass a resolve()d href -->
<a class="toc-row" class:latest class:compact {href}>
	<span class="num">{number}</span>
	<span class="title">{title}</span>
	<span class="leader" aria-hidden="true"></span>
	<span class="date">
		{#if latest}<span class="dot" aria-hidden="true"></span>{/if}
		{capitalize(relativeDay(updatedAt))}
	</span>
</a>

<style>
	.toc-row {
		display: flex;
		align-items: baseline;
		gap: 16px;
		padding: 11px 18px;
		margin: 0 -18px;
		border-radius: 12px;
		text-decoration: none;
		color: var(--bb-text);
	}

	.toc-row:hover {
		background: #131b42;
		color: var(--bb-text);
	}

	.num {
		flex: none;
		width: 92px;
		text-align: right;
		font-family: var(--font-display);
		font-size: 17px;
		color: var(--bb-text-4);
	}

	.title {
		min-width: 0;
		font-family: var(--font-read);
		font-size: 20px;
		overflow-wrap: break-word;
	}

	.leader {
		flex: 1 1 24px;
		min-width: 24px;
		border-bottom: 1.5px dotted var(--bb-line);
	}

	.toc-row:hover .leader {
		border-color: var(--bb-line-dashed);
	}

	.date {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.latest {
		background: var(--bb-ink);
	}

	.latest .num {
		color: var(--bb-sky);
	}

	.latest .leader {
		border-color: var(--bb-line-control);
	}

	.latest .date {
		color: var(--bb-sky-text);
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--bb-sky);
	}

	.compact .num {
		width: 32px;
	}

	@media (max-width: 600px) {
		.toc-row {
			gap: 12px;
			padding: 11px 12px;
			margin: 0 -12px;
		}

		.num {
			width: 24px;
		}

		.title {
			font-size: 18px;
		}
	}
</style>
