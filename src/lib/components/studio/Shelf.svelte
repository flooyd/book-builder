<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { deleteDraft, listDrafts, type DraftInfo } from '$lib/studio/draft';
	import NewDrawing from './NewDrawing.svelte';

	// The studio's front page: the drawings kept in this browser, newest first, and a way to start
	// one. Nothing here reaches the server.
	let { owner }: { owner: string } = $props();

	useAppHeader((header) => {
		header.crumbs = [{ label: 'Studio' }];
	});

	type Card = DraftInfo & { picture: string | null };
	let drafts = $state<Card[] | null>(null);
	let failed = $state(false);
	let starting = $state(false);
	let doomed = $state<Card | null>(null);
	let deleting = $state(false);

	async function load() {
		try {
			const found = await listDrafts(owner);
			drafts?.forEach((card) => card.picture && URL.revokeObjectURL(card.picture));
			drafts = found.map((info) => ({
				...info,
				picture: info.thumb ? URL.createObjectURL(info.thumb) : null
			}));
		} catch {
			failed = true;
			drafts = [];
		}
	}

	onMount(() => {
		void load();
		return () => drafts?.forEach((card) => card.picture && URL.revokeObjectURL(card.picture));
	});

	async function remove() {
		if (!doomed) return;
		deleting = true;
		try {
			await deleteDraft(doomed.key);
			doomed = null;
			await load();
		} finally {
			deleting = false;
		}
	}

	const day = 24 * 60 * 60 * 1000;
	function when(time: number) {
		const ago = Date.now() - time;
		if (ago < 60_000) return 'Just now';
		if (ago < 60 * 60_000) return `${Math.round(ago / 60_000)} min ago`;
		if (ago < day && new Date(time).getDate() === new Date().getDate()) {
			return `Today, ${new Date(time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
		}
		if (ago < 2 * day) return 'Yesterday';
		return new Date(time).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Studio · Book Builder</title>
</svelte:head>

<div class="shelf">
	<header class="top">
		<div>
			<p class="overline">Studio</p>
			<h1>Make your own art</h1>
			<p class="lede">
				Draw covers, portraits, maps and ornaments with shapes, the pen and the pencil, in layers.
				Drawings are kept in this browser as you work; save one to your art shelf to put it on a
				book’s cover.
			</p>
		</div>
		<div class="top-actions">
			<Button size="lg" href={resolve('/art')}><Icon name="image" size={18} /> Art shelf</Button>
			<Button variant="primary" size="lg" glow onclick={() => (starting = true)}>
				<Icon name="plus" size={18} /> New drawing
			</Button>
		</div>
	</header>

	{#if drafts === null}
		<p class="quiet" aria-busy="true">Looking for your drawings…</p>
	{:else if failed}
		<p class="quiet">
			This browser won’t let the studio keep drawings. Its storage may be switched off, as it is in
			some private windows.
		</p>
	{:else if drafts.length === 0}
		<div class="empty">
			<div class="empty-art" aria-hidden="true">
				<span class="blob one"></span>
				<span class="blob two"></span>
				<span class="blob three"></span>
			</div>
			<h2>No drawings yet</h2>
			<p>Start one for a cover, a character or a map.</p>
			<Button variant="primary" onclick={() => (starting = true)}>Start a drawing</Button>
		</div>
	{:else}
		<ul class="grid">
			{#each drafts as card (card.key)}
				<li class="card">
					<a class="open" href={resolve('/studio/draft/[key]', { key: card.key })}>
						<span class="frame">
							{#if card.picture}
								<img src={card.picture} alt="" style:aspect-ratio="{card.width} / {card.height}" />
							{:else}
								<span class="blank" style:aspect-ratio="{card.width} / {card.height}"></span>
							{/if}
						</span>
						<span class="name">{card.title || 'Untitled drawing'}</span>
						<span class="meta">{card.width} × {card.height} · {when(card.updatedAt)}</span>
					</a>
					<button
						type="button"
						class="delete"
						aria-label="Delete {card.title || 'this drawing'}"
						title="Delete"
						onclick={() => (doomed = card)}
					>
						<Icon name="trash" size={15} />
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if starting}
	<NewDrawing {owner} onclose={() => (starting = false)} />
{/if}

{#if doomed}
	<Dialog labelledby="delete-drawing-title" onclose={() => (doomed = null)} width={460}>
		<div class="confirm">
			<h2 id="delete-drawing-title">Delete “{doomed.title || 'Untitled drawing'}”?</h2>
			<p>It’s kept only in this browser, so once it’s gone it can’t come back.</p>
			<div class="actions">
				<Button variant="quiet" onclick={() => (doomed = null)}>Keep it</Button>
				<Button variant="danger" disabled={deleting} onclick={remove}
					>{deleting ? 'Deleting…' : 'Delete'}</Button
				>
			</div>
		</div>
	</Dialog>
{/if}

<style>
	.shelf {
		max-width: 1280px;
		margin: 0 auto;
		padding: 40px 32px 80px;
		font-family: var(--font-ui);
	}

	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 20px 32px;
		margin-bottom: 36px;
	}

	.top-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.overline {
		margin: 0 0 8px;
		color: var(--bb-sky);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
	}

	h1 {
		margin: 0;
		color: var(--bb-text-strong);
		font: 400 clamp(32px, 5vw, 44px) / 1.1 var(--font-display);
	}

	.lede {
		max-width: 560px;
		margin: 12px 0 0;
		color: var(--bb-text-desc);
		font: 400 17px / 1.55 var(--font-read);
	}

	.quiet {
		color: var(--bb-text-3);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 28px 24px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		position: relative;
	}

	.open {
		display: flex;
		flex-direction: column;
		gap: 4px;
		border-radius: 14px;
		color: inherit;
		text-decoration: none;
	}

	.frame {
		display: grid;
		place-items: center;
		height: 220px;
		margin-bottom: 8px;
		padding: 18px;
		border: 1px solid var(--bb-line-faint);
		border-radius: 14px;
		background: light-dark(#e9e4d9, #070b1c);
		transition:
			border-color 0.2s,
			transform 0.2s;
	}

	.open:hover .frame {
		border-color: var(--bb-line-control);
		transform: translateY(-2px);
	}

	.frame img,
	.blank {
		display: block;
		max-width: 100%;
		max-height: 100%;
		box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.5);
		background: repeating-conic-gradient(#e3e3e3 0 25%, #fff 0 50%) 0 0 / 12px 12px;
	}

	.blank {
		width: 60%;
		background: var(--bb-paper);
	}

	.name {
		overflow: hidden;
		color: var(--bb-text-strong);
		font-size: 15px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		color: var(--bb-text-3);
		font-size: 12.5px;
		font-variant-numeric: tabular-nums;
	}

	.delete {
		position: absolute;
		top: 10px;
		right: 10px;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border: 1px solid var(--bb-line-soft);
		border-radius: 9px;
		background: var(--bb-ink);
		color: var(--bb-text-label);
		opacity: 0;
		transition: opacity 0.15s;
	}

	.card:hover .delete,
	.delete:focus-visible {
		opacity: 1;
	}

	.delete:hover {
		color: var(--bb-coral);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 56px 20px;
		border: 1px dashed var(--bb-line-dashed);
		border-radius: var(--r-card);
		text-align: center;
	}

	.empty h2 {
		margin: 8px 0 0;
		color: var(--bb-text-strong);
		font: 400 24px var(--font-display);
	}

	.empty p {
		margin: 0 0 10px;
		color: var(--bb-text-2);
	}

	.empty-art {
		position: relative;
		width: 120px;
		height: 84px;
	}

	.blob {
		position: absolute;
		display: block;
	}

	.one {
		left: 6px;
		top: 18px;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: #e8b04b;
	}

	.two {
		left: 44px;
		top: 6px;
		width: 52px;
		height: 52px;
		border-radius: 10px;
		background: #2f6bff;
		mix-blend-mode: multiply;
		transform: rotate(12deg);
	}

	.three {
		left: 70px;
		top: 40px;
		width: 0;
		height: 0;
		border-left: 24px solid transparent;
		border-right: 24px solid transparent;
		border-bottom: 40px solid #e0603a;
	}

	.confirm {
		padding: 26px 28px 22px;
	}

	.confirm h2 {
		margin: 0 0 10px;
		color: var(--bb-text-strong);
		font: 400 22px / 1.25 var(--font-display);
		overflow-wrap: anywhere;
	}

	.confirm p {
		margin: 0;
		color: var(--bb-text-2);
		line-height: 1.55;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 20px;
	}

	@media (hover: none) {
		.delete {
			opacity: 1;
		}
	}

	@media (max-width: 600px) {
		.shelf {
			padding: 28px 16px 64px;
		}

		.grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 20px 14px;
		}

		.frame {
			height: 160px;
			padding: 12px;
		}
	}
</style>
