<script lang="ts">
	import { resolve } from '$app/paths';
	import { ACCOUNT_PHRASE, typedTitle } from '$lib/confirm';
	import { plural, sendJSON } from '$lib/library';
	import {
		artStore,
		booksStore,
		chaptersStore,
		charactersStore,
		partsStore,
		placesStore,
		seriesStore,
		systemsStore
	} from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// Asks before an account is deleted, and says plainly what goes with it, counted from the
	// library already loaded in the browser. It won't go ahead until "delete my account" has been
	// typed and the password given: nothing can bring any of it back.
	let {
		publicPage,
		onclose
	}: {
		/** Their author page is public, so readers would find it gone. */
		publicPage: boolean;
		onclose: () => void;
	} = $props();

	const uid = $props.id();
	let typed = $state('');
	let password = $state('');
	let busy = $state(false);
	let error = $state('');

	const ready = $derived(typedTitle(typed, ACCOUNT_PHRASE) && password.length > 0);

	const books = $derived($booksStore.length);
	const shared = $derived($booksStore.filter((book) => book.shareId).length);
	const entries = $derived($charactersStore.length + $placesStore.length + $systemsStore.length);

	/** "3 books (4 parts, 41 chapters), with all their story text", or less when there's less. */
	const bookLine = $derived.by(() => {
		const inside = [
			$partsStore.length ? plural($partsStore.length, 'part') : '',
			$chaptersStore.length ? plural($chaptersStore.length, 'chapter') : ''
		].filter(Boolean);
		return `${plural(books, 'book')}${inside.length ? ` (${inside.join(', ')})` : ''}, with all ${books === 1 ? 'its' : 'their'} story text and every earlier version of it`;
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!ready || busy) return;
		busy = true;
		error = '';
		try {
			await sendJSON('DELETE', '/api/account', { typed, password });
			// A whole page load, so nothing of the library stays behind in this tab.
			window.location.assign(`${resolve('/login')}?deleted`);
		} catch (problem) {
			error = problem instanceof Error ? problem.message : "Couldn't delete your account.";
			busy = false;
		}
	}
</script>

<Dialog labelledby="{uid}-title" width={500} {onclose}>
	<form class="confirm" onsubmit={submit} novalidate>
		<h2 id="{uid}-title">Delete your account?</h2>

		<p class="warning">
			<Icon name="alert-circle" size={20} />
			<span>
				<strong>You will lose everything.</strong> Your account and all you've made here are deleted for
				good. There's no undo, and nobody can bring any of it back.
			</span>
		</p>

		<div class="losing">
			<p class="losing-head">Gone with it:</p>
			<ul>
				{#if books}
					<li>
						<Icon name="book" size={16} /><span>{bookLine}</span>
					</li>
				{/if}
				{#if $seriesStore.length}
					<li>
						<Icon name="library" size={16} /><span
							>{plural($seriesStore.length, 'series', 'series')}</span
						>
					</li>
				{/if}
				{#if entries}
					<li>
						<Icon name="users" size={16} /><span
							>{plural(entries, 'character, place or system', 'characters, places and systems')} in your
							story bible, with their notes and connections</span
						>
					</li>
				{/if}
				{#if publicPage || shared}
					<li>
						<Icon name="globe" size={16} /><span
							>{publicPage ? 'Your public author page' : ''}{publicPage && shared
								? ' and '
								: ''}{shared ? plural(shared, 'share link') : ''}: readers who have them will find
							nothing there</span
						>
					</li>
				{/if}
				{#if $artStore.length}
					<li>
						<Icon name="image" size={16} /><span
							>{plural($artStore.length, 'picture')} on your art shelf, and every cover made from one</span
						>
					</li>
				{/if}
				<li><Icon name="flame" size={16} /><span>Your writing goals, streak and history</span></li>
			</ul>
			{#if books}
				<p class="copy">
					Want a copy first? Each book's page can export it as a PDF or a Word file.
				</p>
			{/if}
		</div>

		<div class="field">
			<label for="{uid}-typed">Type <strong>{ACCOUNT_PHRASE}</strong> to confirm</label>
			<input
				bind:value={typed}
				id="{uid}-typed"
				class="bb-field"
				type="text"
				autocomplete="off"
				autocorrect="off"
				autocapitalize="off"
				spellcheck="false"
				disabled={busy}
			/>
		</div>

		<div class="field">
			<label for="{uid}-password">Your password</label>
			<input
				bind:value={password}
				id="{uid}-password"
				class="bb-field"
				type="password"
				autocomplete="current-password"
				disabled={busy}
			/>
		</div>

		{#if error}
			<p class="error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
		{/if}

		<div class="confirm-actions">
			<Button variant="quiet" onclick={onclose} disabled={busy}>Keep my account</Button>
			<Button type="submit" variant="danger" disabled={!ready || busy}>
				<Icon name="trash" size={16} />{busy ? 'Deleting…' : 'Delete my account'}
			</Button>
		</div>
	</form>
</Dialog>

<style>
	.confirm {
		padding: 28px 30px 26px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		line-height: 1.1;
		color: var(--bb-text-strong);
	}

	.warning {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		border-radius: var(--r-control);
		background: var(--bb-coral-wash);
		border: 1px solid var(--bb-coral-line);
		font-size: 15px;
		line-height: 1.5;
		color: var(--bb-text);
	}

	.warning :global(svg) {
		margin-top: 1px;
		color: var(--bb-coral);
	}

	.warning strong {
		color: var(--bb-coral-soft);
	}

	.losing {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.losing-head {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	li {
		display: flex;
		gap: 10px;
		font-size: 14.5px;
		line-height: 1.45;
		color: var(--bb-text-2);
	}

	li :global(svg) {
		margin-top: 2px;
		color: var(--bb-text-3);
	}

	.copy {
		font-size: 14px;
		line-height: 1.45;
		color: var(--bb-text-3);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	label strong {
		color: var(--bb-text-strong);
	}

	.bb-field {
		background: var(--bb-night);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}

	.confirm-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 8px;
		padding-top: 20px;
		border-top: 1px solid var(--bb-line-soft);
	}

	@media (max-width: 600px) {
		.confirm {
			padding: 24px 20px 20px;
		}

		h2 {
			font-size: 26px;
		}
	}
</style>
