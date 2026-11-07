<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// Choosing a new password from the link in a reset email, or, when the link is spent, a way to
	// ask for another.
	let { data, form }: PageProps = $props();

	let saving = $state(false);
	let shown = $state(false);
	const expired = $derived(data.expired || !!form?.expired);
	const error = $derived(form?.message);
</script>

<svelte:head>
	<title>Choose a new password · Book Builder</title>
</svelte:head>

<AuthShell>
	{#if expired}
		<div class="stack">
			<div class="intro">
				<span class="tile" aria-hidden="true"><Icon name="alert-circle" size={26} /></span>
				<h1>That link has expired</h1>
				<p>
					A link to choose a new password works once, for an hour. Ask for a new one and it'll be in
					your inbox in a minute.
				</p>
			</div>
			<Button href={resolve('/forgot-password')} variant="primary" size="lg" block glow>
				Send a new link<Icon name="arrow-right" size={18} />
			</Button>
			<p class="foot">Remembered it? <a href={resolve('/login')}>Log in</a>.</p>
		</div>
	{:else}
		<form
			class="stack"
			method="post"
			use:enhance={() => {
				saving = true;
				return async ({ update }) => {
					await update({ reset: false });
					saving = false;
				};
			}}
		>
			<div class="intro">
				<span class="tile" aria-hidden="true"><Icon name="key" size={26} /></span>
				<h1>Choose a new password</h1>
				<p>Once it's saved you'll be logged in here, and logged out everywhere else.</p>
			</div>
			<input type="hidden" name="token" value={data.token} />
			<div class="field">
				<span class="label">
					<label for="new-password">New password</label>
					<button
						type="button"
						class="show"
						aria-controls="new-password"
						aria-pressed={shown}
						onclick={() => (shown = !shown)}>{shown ? 'Hide' : 'Show'}</button
					>
				</span>
				<input
					class="bb-field"
					id="new-password"
					type={shown ? 'text' : 'password'}
					name="password"
					autocomplete="new-password"
					minlength="8"
					required
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? 'reset-error' : 'reset-hint'}
				/>
				{#if error}
					<span id="reset-error" class="error" role="alert">
						<Icon name="alert-circle" size={16} />{error}
					</span>
				{:else}
					<span id="reset-hint" class="hint">At least 8 characters.</span>
				{/if}
			</div>
			<Button type="submit" variant="primary" size="lg" block glow disabled={saving}>
				{saving ? 'Saving…' : 'Save and log in'}<Icon name="arrow-right" size={18} />
			</Button>
		</form>
	{/if}
</AuthShell>

<style>
	.label label {
		font: inherit;
		color: inherit;
	}

	/* Taller to the finger than it looks. */
	.show {
		margin: -12px -8px;
		padding: 12px 8px;
		border: none;
		background: none;
		font: inherit;
		font-size: 13.5px;
		font-weight: 500;
		color: var(--bb-sky);
		cursor: pointer;
	}

	.hint {
		font-size: 13.5px;
	}
</style>
