<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import {
		booksStore,
		charactersStore,
		modalStore,
		systemsStore,
		type Character
	} from '$lib/stores';
	import { initials } from '$lib/library';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichText from '$lib/components/rich/RichText.svelte';
	import BookGoal from '$lib/components/goals/BookGoal.svelte';

	// Sharing, characters and systems of one book (Book.dc.html aside).
	let { bookId }: { bookId: number } = $props();

	// ---- Readers: the public link ------------------------------------------------------------
	const book = $derived($booksStore.find((b) => b.id === bookId));
	const sharePath = $derived(
		book?.shareId ? resolve('/read/[shareId]', { shareId: book.shareId }) : ''
	);
	let sharing = $state(false);
	let shareError = $state('');
	let copied = $state(false);
	let linkInput = $state<HTMLInputElement>();

	async function setShared(shared: boolean) {
		sharing = true;
		shareError = '';
		try {
			const response = await fetch(`/api/book/${bookId}/share`, {
				method: shared ? 'POST' : 'DELETE'
			});
			const data = await response.json().catch(() => null);
			if (!response.ok) throw new Error(data?.error ?? `Request failed (${response.status}).`);
			booksStore.update((books) => books.map((b) => (b.id === data.id ? data : b)));
			copied = false;
		} catch (error) {
			shareError = error instanceof Error ? error.message : "Couldn't change sharing.";
		} finally {
			sharing = false;
		}
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(page.url.origin + sharePath);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard access: select the link so it can be copied by hand.
			linkInput?.select();
		}
	}

	const characters = $derived($charactersStore.filter((c) => c.bookIds.includes(bookId)));
	const systems = $derived($systemsStore.filter((s) => s.bookIds.includes(bookId)));

	const bookTitle = (id: number) => $booksStore.find((b) => b.id === id)?.title;

	/** "Also in X, Y" for items shared with other books, otherwise null. */
	function alsoIn(bookIds: number[]) {
		const others = bookIds
			.filter((id) => id !== bookId)
			.map(bookTitle)
			.filter(Boolean);
		return others.length > 0 ? `Also in ${others.join(', ')}` : null;
	}

	// Monogram colours vary per character, as in the mockup.
	const TONES = ['paper', 'royal', 'raised'] as const;
	const tone = (character: Character) => TONES[character.id % TONES.length];
</script>

<aside class="aside">
	<motion-stagger interval={0.12} delay={0.2}>
		{#if book}
			<section aria-labelledby="h-readers" class="panel">
				<div class="panel-head">
					<h2 id="h-readers">Readers</h2>
					<span class={['status', { shared: !!book.shareId }]}>
						<Icon name={book.shareId ? 'globe' : 'lock'} size={13} />
						{book.shareId ? 'Shared' : 'Private'}
					</span>
				</div>
				<div class="share">
					<button
						type="button"
						class="switch"
						role="switch"
						aria-checked={!!book.shareId}
						aria-labelledby="share-label"
						aria-describedby="share-hint"
						disabled={sharing}
						onclick={() => setShared(!book.shareId)}><span class="knob"></span></button
					>
					<div class="share-text">
						<span id="share-label" class="share-label">Share with a link</span>
						<span id="share-hint" class="share-hint">
							Anyone with the link can read the book, no account needed. Turning it off breaks the
							link.
						</span>
					</div>
				</div>
				{#if book.shareId}
					<div class="link-row">
						<label class="sr-only" for="share-link">Public link</label>
						<input
							bind:this={linkInput}
							id="share-link"
							class="bb-field link"
							readonly
							value={page.url.origin + sharePath}
							onfocus={(event) => event.currentTarget.select()}
						/>
						<Button onclick={copyLink}>
							<Icon name={copied ? 'check' : 'copy'} size={15} />{copied ? 'Copied' : 'Copy'}
						</Button>
					</div>
					<span class="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- sharePath is resolve()d -->
					<a class="panel-link" href={sharePath} target="_blank" rel="noopener">
						<Icon name="book-open" size={15} />See what readers see
					</a>
				{/if}
				{#if shareError}
					<p class="share-error" role="alert">
						<Icon name="alert-circle" size={15} />{shareError}
					</p>
				{/if}
			</section>
		{/if}

		<BookGoal {bookId} />

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
						<span class="person-meta">{alsoIn(character.bookIds) ?? bookTitle(bookId)}</span>
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
					<div class="system-head">
						<span class="kind">{system.kind || 'System'}</span>
						<button
							type="button"
							class="edit"
							aria-label="Edit {system.name}"
							onclick={() =>
								modalStore.set({ type: 'edit', category: 'system', systemId: system.id, bookId })}
						>
							<Icon name="pen" size={15} />
						</button>
					</div>
					<span class="system-name">{system.name}</span>
					{#if system.description}
						<span class="system-desc"><RichText value={system.description} italic /></span>
					{/if}
					{#if alsoIn(system.bookIds)}
						<span class="system-meta">{alsoIn(system.bookIds)}</span>
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
	</motion-stagger>
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
		box-shadow: inset 0 0 0 1px light-dark(rgba(60, 40, 10, 0.16), transparent);
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
		border: 1px solid var(--bb-line-soft);
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

	.system-meta {
		margin-top: 2px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.system-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	/* 44px hit area that doesn't push the card's layout around. */
	.edit {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -12px -10px -12px 0;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
	}

	.edit:hover {
		background: var(--bb-raised);
		color: var(--bb-text);
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

	a.panel-link {
		text-decoration: none;
	}

	/* Readers */
	.status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--bb-text-3);
	}

	.status.shared {
		color: var(--bb-sky-text);
	}

	.share {
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}

	.switch {
		position: relative;
		flex: none;
		width: 44px;
		height: 26px;
		margin-top: 1px;
		padding: 0;
		border: none;
		border-radius: var(--r-pill);
		background: var(--bb-line-control);
		transition: background-color 0.2s;
	}

	/* 44px tall to the finger. */
	.switch::before {
		content: '';
		position: absolute;
		inset: -9px 0;
	}

	.switch[aria-checked='true'] {
		background: var(--bb-royal);
	}

	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
		transition: transform 0.25s cubic-bezier(0.3, 1.4, 0.5, 1);
	}

	.switch[aria-checked='true'] .knob {
		transform: translateX(18px);
	}

	.switch:disabled {
		opacity: 0.6;
	}

	.share-text {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.share-label {
		font-weight: 600;
		font-size: 15px;
	}

	.share-hint {
		font-size: 13.5px;
		line-height: 1.45;
		color: var(--bb-text-3);
	}

	.link-row {
		display: flex;
		gap: 8px;
	}

	.link {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		padding: 0 12px;
		font-size: 13.5px;
		text-overflow: ellipsis;
	}

	.share-error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	@media (prefers-reduced-motion: reduce) {
		.switch,
		.knob {
			transition: none;
		}
	}
</style>
