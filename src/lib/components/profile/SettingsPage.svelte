<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useAppHeader } from '$lib/app-header.svelte';
	import { initials, plural, sendJSON } from '$lib/library';
	import { handleProblem, suggestHandle } from '$lib/profile';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import RichEditor from '$lib/components/rich/RichEditor.svelte';

	type Settings = { handle: string | null; bio: string; website: string; isPublic: boolean };

	// Your profile (name, bio, website, public page) and account (email, password).
	let {
		name: savedName,
		email,
		profile,
		sharedBooks
	}: { name: string; email: string; profile: Settings; sharedBooks: number } = $props();

	useAppHeader((header) => {
		header.crumbs = [{ label: 'Library', href: resolve('/') }, { label: 'Settings' }];
	});

	// The page's values as loaded; from then on these fields are the source of truth.
	// svelte-ignore state_referenced_locally
	let name = $state(savedName);
	// svelte-ignore state_referenced_locally
	let bio = $state(profile.bio);
	// svelte-ignore state_referenced_locally
	let website = $state(profile.website);
	// svelte-ignore state_referenced_locally
	let isPublic = $state(profile.isPublic);
	// svelte-ignore state_referenced_locally
	let handle = $state(profile.handle ?? suggestHandle(savedName));
	/** What the server has: the public page exists only once saved. */
	// svelte-ignore state_referenced_locally
	let saved = $state({ handle: profile.handle, isPublic: profile.isPublic });

	let bioEditor = $state<RichEditor>();
	let saving = $state(false);
	let message = $state<{ text: string; error: boolean } | null>(null);

	const handleError = $derived(
		handle ? handleProblem(handle) : isPublic ? 'Choose an address for your public page.' : null
	);
	const pagePath = $derived(
		saved.handle ? resolve('/author/[handle]', { handle: saved.handle }) : ''
	);

	async function save(event: SubmitEvent) {
		event.preventDefault();
		bioEditor?.flush();
		if (handleError && (isPublic || handle)) {
			message = { text: handleError, error: true };
			return;
		}
		saving = true;
		message = null;
		try {
			const result = await sendJSON<Settings & { name: string }>('PUT', '/api/profile', {
				name,
				bio,
				website,
				isPublic,
				handle
			});
			name = result.name;
			website = result.website;
			handle = result.handle ?? handle;
			saved = { handle: result.handle, isPublic: result.isPublic };
			message = { text: 'Saved.', error: false };
			await invalidateAll(); // the header's initial, the "by" line on covers
		} catch (error) {
			message = {
				text: error instanceof Error ? error.message : "Couldn't save your settings.",
				error: true
			};
		} finally {
			saving = false;
		}
	}

	// ---- Password ----------------------------------------------------------------------------
	let currentPassword = $state('');
	let newPassword = $state('');
	let signOutOthers = $state(false);
	let changing = $state(false);
	let passwordMessage = $state<{ text: string; error: boolean } | null>(null);

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		changing = true;
		passwordMessage = null;
		try {
			await sendJSON('PUT', '/api/profile/password', {
				currentPassword,
				newPassword,
				signOutOthers
			});
			currentPassword = newPassword = '';
			passwordMessage = {
				text: signOutOthers
					? 'Password changed. Your other devices are signed out.'
					: 'Password changed.',
				error: false
			};
		} catch (error) {
			passwordMessage = {
				text: error instanceof Error ? error.message : "Couldn't change your password.",
				error: true
			};
		} finally {
			changing = false;
		}
	}
</script>

<svelte:head>
	<title>Settings · Book Builder</title>
</svelte:head>

<main class="settings">
	<header class="head">
		<span class="monogram" aria-hidden="true">{initials(name || savedName)}</span>
		<div>
			<p class="overline">Settings</p>
			<h1>Your profile</h1>
		</div>
	</header>

	<form class="cards" onsubmit={save} novalidate>
		<section class="card" aria-labelledby="h-profile">
			<h2 id="h-profile">Profile</h2>
			<div class="field">
				<label for="profile-name">Name</label>
				<input
					id="profile-name"
					class="bb-field"
					bind:value={name}
					autocomplete="name"
					maxlength="80"
					required
				/>
				<p class="hint">The “by” line on your books and your public page.</p>
			</div>
			<div class="field">
				<p class="label">Bio <span class="optional">Optional</span></p>
				<RichEditor
					bind:this={bioEditor}
					kind="description"
					class="bio"
					boxed
					value={bio}
					onchange={(value) => (bio = value)}
					label="Bio"
					placeholder="A line or two about you and what you write."
				/>
			</div>
			<div class="field">
				<label for="profile-website">Website <span class="optional">Optional</span></label>
				<input
					id="profile-website"
					class="bb-field"
					bind:value={website}
					type="url"
					inputmode="url"
					autocomplete="url"
					placeholder="yourname.com"
				/>
			</div>
		</section>

		<section class="card" aria-labelledby="h-public">
			<div class="card-head">
				<h2 id="h-public">Public page</h2>
				<span class={['status', { on: saved.isPublic }]}>
					<Icon name={saved.isPublic ? 'globe' : 'lock'} size={13} />
					{saved.isPublic ? 'Public' : 'Private'}
				</span>
			</div>
			<div class="share">
				<button
					type="button"
					class="switch"
					role="switch"
					aria-checked={isPublic}
					aria-labelledby="public-label"
					aria-describedby="public-hint"
					onclick={() => (isPublic = !isPublic)}><span class="knob"></span></button
				>
				<div class="share-text">
					<span id="public-label" class="share-label">Show my author page</span>
					<span id="public-hint" class="hint">
						Anyone can see your name, bio, website and the books you share with a link. Books that
						aren't shared never appear.
					</span>
				</div>
			</div>
			<div class="field">
				<label for="profile-handle">Address</label>
				<div class="address">
					<span class="prefix">{page.url.host}/author/</span>
					<input
						id="profile-handle"
						class="bb-field"
						bind:value={handle}
						oninput={() => (handle = handle.toLowerCase())}
						autocomplete="off"
						spellcheck="false"
						maxlength="30"
						aria-invalid={handleError ? 'true' : undefined}
						aria-describedby="handle-hint"
					/>
				</div>
				<p id="handle-hint" class={['hint', { problem: !!handleError }]}>
					{handleError ?? 'Lowercase letters, numbers and dashes.'}
				</p>
			</div>
			{#if saved.isPublic && pagePath}
				<p class="public-note">
					Your page lists {plural(sharedBooks, 'shared book')}.
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- pagePath is resolve()d -->
					<a href={pagePath}>View your page <Icon name="arrow-right" size={14} /></a>
				</p>
			{/if}
		</section>

		<div class="actions">
			<Button type="submit" variant="primary" disabled={saving}>
				<Icon name="check" size={16} />{saving ? 'Saving…' : 'Save changes'}
			</Button>
			<p class={['message', { error: message?.error }]} role="status">{message?.text ?? ''}</p>
		</div>
	</form>

	<section class="card" aria-labelledby="h-account">
		<h2 id="h-account">Account</h2>
		<div class="field">
			<p class="label">Email</p>
			<p class="email">{email}</p>
		</div>
		<form class="password" onsubmit={changePassword}>
			<h3>Change password</h3>
			<div class="field">
				<label for="current-password">Current password</label>
				<input
					id="current-password"
					class="bb-field"
					type="password"
					autocomplete="current-password"
					bind:value={currentPassword}
					required
				/>
			</div>
			<div class="field">
				<label for="new-password">New password</label>
				<input
					id="new-password"
					class="bb-field"
					type="password"
					autocomplete="new-password"
					minlength="8"
					bind:value={newPassword}
					required
				/>
				<p class="hint">At least 8 characters.</p>
			</div>
			<label class="check">
				<input type="checkbox" bind:checked={signOutOthers} />
				Sign out my other devices
			</label>
			<div class="actions">
				<Button type="submit" disabled={changing || !currentPassword || !newPassword}>
					{changing ? 'Changing…' : 'Change password'}
				</Button>
				<p class={['message', { error: passwordMessage?.error }]} role="status">
					{passwordMessage?.text ?? ''}
				</p>
			</div>
		</form>
	</section>
</main>

<style>
	.settings {
		max-width: 760px;
		margin: 0 auto;
		padding: 44px 32px 96px;
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.head {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-bottom: 6px;
	}

	.monogram {
		flex: none;
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: light-dark(#141c45, var(--bb-paper));
		color: light-dark(var(--bb-paper), #141c45);
		font-family: var(--font-display);
		font-size: 28px;
	}

	.overline {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--bb-sky);
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(38px, 4vw, 52px);
		line-height: 1.05;
		color: var(--bb-text-strong);
	}

	.cards {
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 24px 26px;
		border-radius: var(--r-card);
		background: var(--bb-ink);
		border: 1px solid var(--bb-line-soft);
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 26px;
		color: var(--bb-text-strong);
	}

	h3 {
		font-size: 15px;
		font-weight: 700;
		color: var(--bb-text);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label,
	.label {
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.optional {
		margin-left: 6px;
		font-weight: 500;
		color: var(--bb-text-4);
	}

	.hint {
		font-size: 13.5px;
		line-height: 1.45;
		color: var(--bb-text-3);
	}

	.hint.problem {
		color: var(--bb-coral-soft);
	}

	.field :global(.bio) {
		font-family: var(--font-read);
		font-size: 17px;
		line-height: 1.5;
		color: var(--bb-text);
	}

	.address {
		display: flex;
		align-items: center;
		border-radius: var(--r-control);
		border: 1px solid var(--bb-line-control);
		background: var(--bb-ink);
	}

	.address:focus-within {
		border-color: var(--bb-sky);
		box-shadow: var(--focus-ring);
	}

	.prefix {
		padding-left: 16px;
		font-size: 15px;
		color: var(--bb-text-3);
		white-space: nowrap;
	}

	.address .bb-field {
		min-width: 0;
		padding-left: 2px;
		border: none;
		background: transparent;
		box-shadow: none;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--bb-text-3);
	}

	.status.on {
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

	.share-text {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.share-label {
		font-weight: 600;
		font-size: 15px;
		color: var(--bb-text);
	}

	.public-note {
		font-size: 14.5px;
		color: var(--bb-text-2);
	}

	.public-note a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 6px;
		font-weight: 600;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
	}

	.message {
		font-size: 14px;
		color: var(--bb-text-2);
	}

	.message.error {
		color: var(--bb-coral-soft);
	}

	.email {
		font-size: 16px;
		color: var(--bb-text);
	}

	.password {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding-top: 18px;
		border-top: 1px solid var(--bb-line-soft);
	}

	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		font-weight: 400;
		color: var(--bb-text-label);
		cursor: pointer;
	}

	.check input {
		width: 18px;
		height: 18px;
		accent-color: var(--bb-royal);
	}

	@media (max-width: 600px) {
		.settings {
			padding: 28px 16px 72px;
		}

		.card {
			padding: 20px 18px;
		}

		.prefix {
			padding-left: 12px;
			font-size: 13.5px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.switch,
		.knob {
			transition: none;
		}
	}
</style>
