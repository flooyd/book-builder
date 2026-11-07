<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// A forgotten password: the address to send a link to, then "check your inbox".
	let { data, form }: PageProps = $props();

	let sending = $state(false);
	const email = $derived(form?.email ?? data.email);
	const error = $derived(form?.message);
</script>

<svelte:head>
	<title>Forgot your password · Book Builder</title>
</svelte:head>

<AuthShell>
	<form
		class="stack"
		method="post"
		use:enhance={() => {
			sending = true;
			return async ({ update }) => {
				await update({ reset: false });
				sending = false;
			};
		}}
	>
		{#if form?.sent}
			<div class="intro">
				<span class="tile" aria-hidden="true"><Icon name="mail" size={26} /></span>
				<h1>Check your inbox</h1>
				<p>
					If there's an account for <strong>{email}</strong>, a link to choose a new password is on
					its way. It works once, for the next hour.
				</p>
			</div>
			<input type="hidden" name="email" value={email} />
			<Button href={resolve('/login')} variant="primary" size="lg" block glow>
				Back to log in<Icon name="arrow-right" size={18} />
			</Button>
			<p class="foot">
				Nothing there? Look in your spam folder, or
				<button type="submit" class="again" disabled={sending}>send it again</button>.
			</p>
		{:else}
			<div class="intro">
				<span class="tile" aria-hidden="true"><Icon name="key" size={26} /></span>
				<h1>Forgot your password?</h1>
				<p>Enter the email you log in with, and we'll send a link to choose a new one.</p>
			</div>
			<div class="field">
				<label for="forgot-email">Email</label>
				<input
					class="bb-field"
					id="forgot-email"
					type="email"
					name="email"
					autocomplete="email"
					required
					value={email}
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? 'forgot-error' : undefined}
				/>
				{#if error}
					<span id="forgot-error" class="error" role="alert">
						<Icon name="alert-circle" size={16} />{error}
					</span>
				{/if}
			</div>
			<Button type="submit" variant="primary" size="lg" block glow disabled={sending}>
				{sending ? 'Sending…' : 'Send the link'}<Icon name="arrow-right" size={18} />
			</Button>
			<p class="foot">Remembered it? <a href={resolve('/login')}>Log in</a>.</p>
		{/if}
	</form>
</AuthShell>

<style>
	/* A link in a sentence that sends the form. */
	.again {
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		color: var(--bb-sky);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}

	.again:hover {
		color: var(--bb-sky-hover);
	}
</style>
