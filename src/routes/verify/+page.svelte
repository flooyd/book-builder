<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// Confirming a new account's email: "check your inbox" with a way to send the link again, or,
	// when a link comes back expired or already used, what happened and a new one.
	let { data, form }: PageProps = $props();

	let sending = $state(false);
	const email = $derived(form?.email ?? data.email);
	const error = $derived(form?.message);

	/** sent: just sent again. unsent: the email couldn't go out. login: tried to log in first.
	 * waiting: a link is on its way. ask: where to send one, after a link that didn't work or with
	 * no address to hand. */
	const stage = $derived(
		form?.sent
			? 'sent'
			: data.problem
				? data.problem
				: data.email
					? data.unsent && !form
						? 'unsent'
						: data.login
							? 'login'
							: 'waiting'
					: 'ask'
	);
	/** There's an address to send to again. */
	const waiting = $derived(['sent', 'unsent', 'login', 'waiting'].includes(stage));

	const HEADINGS = {
		sent: 'Check your inbox',
		unsent: "The email didn't go out",
		waiting: 'Check your inbox',
		login: 'Confirm your email first',
		ask: 'Confirm your email',
		expired: 'That link has expired',
		invalid: "That link didn't work",
		gone: "That link didn't work"
	};
</script>

<svelte:head>
	<title>Confirm your email · Book Builder</title>
</svelte:head>

<AuthShell>
	{#if data.confirmed}
		<div class="stack">
			<div class="intro">
				<span class="tile" aria-hidden="true"><Icon name="check-circle" size={26} /></span>
				<h1>Your email is confirmed</h1>
				<p>Log in and your library is ready for your first book.</p>
			</div>
			<Button href={resolve('/login')} variant="primary" size="lg" block glow>
				Log in<Icon name="arrow-right" size={18} />
			</Button>
		</div>
	{:else}
		<form
			class="stack"
			method="post"
			action="?/resend"
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					await update({ reset: false });
					sending = false;
				};
			}}
		>
			<div class="intro">
				<span class="tile" aria-hidden="true">
					<Icon
						name={stage === 'unsent' || !(waiting || stage === 'ask') ? 'alert-circle' : 'mail'}
						size={26}
					/>
				</span>
				<h1>{HEADINGS[stage]}</h1>
				{#if stage === 'gone'}
					<p>There's no account for that link any more. You can make a new one.</p>
				{:else if stage === 'expired' || stage === 'invalid'}
					<p>
						A link to confirm your email works for 24 hours, and only until it's used. Send yourself
						a new one.
					</p>
				{:else if stage === 'unsent'}
					<p>
						We couldn't send the link to <strong>{email}</strong> just now. Try again in a minute, and
						check the address is right.
					</p>
				{:else if stage === 'login'}
					<p>
						Your account is waiting for you to confirm <strong>{email}</strong>. We've sent a link
						there.
					</p>
				{:else if waiting}
					<p>
						We sent a link to <strong>{email}</strong>. Open it to finish making your account. It
						works for 24 hours.
					</p>
				{:else}
					<p>Enter the email you signed up with, and we'll send a new link to confirm it.</p>
				{/if}
			</div>

			{#if stage === 'sent'}
				<p class="notice" role="status">
					<Icon name="check-circle" size={18} />
					<span>Sent. It can take a minute to arrive.</span>
				</p>
			{/if}

			{#if stage === 'gone'}
				<Button href={resolve('/login')} variant="primary" size="lg" block glow>
					Make an account<Icon name="arrow-right" size={18} />
				</Button>
			{:else if waiting}
				<input type="hidden" name="email" value={email} />
				{#if error}
					<p class="error" role="alert"><Icon name="alert-circle" size={16} />{error}</p>
				{/if}
				<Button type="submit" size="lg" block disabled={sending}>
					<Icon name="mail" size={18} />{sending ? 'Sending…' : 'Send it again'}
				</Button>
				<p class="foot">
					Nothing there? Look in your spam folder. Wrong address?
					<a href={resolve('/login')}>Make the account again</a>.
				</p>
			{:else}
				<div class="field">
					<label for="verify-email">Email</label>
					<input
						class="bb-field"
						id="verify-email"
						type="email"
						name="email"
						autocomplete="email"
						required
						value={email}
						aria-invalid={error ? 'true' : undefined}
						aria-describedby={error ? 'verify-error' : undefined}
					/>
					{#if error}
						<span id="verify-error" class="error" role="alert">
							<Icon name="alert-circle" size={16} />{error}
						</span>
					{/if}
				</div>
				<Button type="submit" variant="primary" size="lg" block glow disabled={sending}>
					{sending ? 'Sending…' : 'Send a new link'}<Icon name="arrow-right" size={18} />
				</Button>
				<p class="foot">Already confirmed? <a href={resolve('/login')}>Log in</a>.</p>
			{/if}
		</form>
	{/if}
</AuthShell>
