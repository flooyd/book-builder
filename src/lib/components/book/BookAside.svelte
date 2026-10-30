<script lang="ts">
	import {
		booksStore,
		charactersStore,
		modalStore,
		systemsStore,
		type Character
	} from '$lib/stores';
	import { initials } from '$lib/library';
	import Icon from '$lib/components/ui/Icon.svelte';

	// Characters and systems of one book (Book.dc.html aside).
	let { bookId }: { bookId: number } = $props();

	const characters = $derived($charactersStore.filter((c) => c.bookIds.includes(bookId)));
	const systems = $derived($systemsStore.filter((s) => s.bookId === bookId));

	const bookTitle = (id: number) => $booksStore.find((b) => b.id === id)?.title;

	function whereElse(character: Character) {
		const others = character.bookIds
			.filter((id) => id !== bookId)
			.map(bookTitle)
			.filter(Boolean);
		return others.length > 0 ? `Also in ${others.join(', ')}` : bookTitle(bookId);
	}

	// Monogram colours vary per character, as in the mockup.
	const TONES = ['paper', 'royal', 'raised'] as const;
	const tone = (character: Character) => TONES[character.id % TONES.length];
</script>

<aside class="aside">
	<section aria-labelledby="h-characters" class="panel">
		<div class="panel-head">
			<h2 id="h-characters">Characters</h2>
			<span class="count">{characters.length}</span>
		</div>
		{#each characters as character (character.id)}
			<div class="person">
				<span class={['avatar', tone(character)]} aria-hidden="true"
					>{initials(character.name)}</span
				>
				<span class="person-text">
					<span class="person-name">{character.name}</span>
					<span class="person-meta">{whereElse(character)}</span>
				</span>
			</div>
		{:else}
			<p class="empty">No characters yet.</p>
		{/each}
		<button
			type="button"
			class="panel-link"
			onclick={() => modalStore.set({ type: 'create', category: 'character', bookId })}
		>
			<Icon name="plus" size={15} strokeWidth={2.2} />New character
		</button>
	</section>

	<section aria-labelledby="h-systems" class="panel">
		<div class="panel-head">
			<h2 id="h-systems">Systems</h2>
			<span class="count">{systems.length}</span>
		</div>
		{#each systems as system (system.id)}
			<div class="system">
				<span class="kind">{system.kind || 'System'}</span>
				<span class="system-name">{system.name}</span>
				{#if system.description}
					<span class="system-desc">{system.description}</span>
				{/if}
			</div>
		{:else}
			<p class="empty">No systems yet.</p>
		{/each}
		<button
			type="button"
			class="panel-link"
			onclick={() => modalStore.set({ type: 'create', category: 'system', bookId })}
		>
			<Icon name="plus" size={15} strokeWidth={2.2} />New system
		</button>
	</section>
</aside>

<style>
	.aside {
		flex: 1 1 320px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.panel {
		padding: 22px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	.count {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.person {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.avatar {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		font-family: var(--font-display);
		font-size: 15px;
	}

	.avatar.paper {
		background: var(--bb-paper);
		color: #141c45;
	}

	.avatar.royal {
		background: var(--bb-royal);
		color: #fff;
	}

	.avatar.raised {
		background: var(--bb-raised);
		box-shadow: inset 0 0 0 1px var(--bb-line-dashed);
		color: var(--bb-sky-text);
	}

	.person-text {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.person-name {
		font-weight: 600;
		font-size: 15px;
		overflow-wrap: anywhere;
	}

	.person-meta {
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.system {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px;
		border-radius: var(--r-control);
		background: var(--bb-panel);
		border: 1px solid #1a2450;
	}

	.kind {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	.system-name {
		font-family: var(--font-display);
		font-size: 19px;
		overflow-wrap: anywhere;
	}

	.system-desc {
		font-family: var(--font-read);
		font-style: italic;
		font-size: 15.5px;
		color: var(--bb-text-2);
	}

	.empty {
		font-size: 14.5px;
		color: var(--bb-text-3);
	}

	.panel-link {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0;
		border: none;
		background: none;
		color: var(--bb-sky);
		font: 600 14.5px var(--font-ui);
	}

	.panel-link:hover {
		color: var(--bb-sky-hover);
	}
</style>
