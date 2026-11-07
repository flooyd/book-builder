<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import AuthShell from '$lib/components/auth/AuthShell.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { data, form }: PageProps = $props();

	let submitting = $state(false);
	const error = $derived(form?.message);

	// What's typed in the email box goes along to the forgotten-password page. It's read on the
	// click, not kept in state: an update anywhere in this form makes Svelte set the email box's
	// value again, which once cost the first letter typed.
	function forgot(event: MouseEvent & { currentTarget: HTMLAnchorElement }) {
		const email = event.currentTarget.closest('form')?.elements.namedItem('email');
		const typed = email instanceof HTMLInputElement ? email.value.trim() : '';
		event.currentTarget.search = typed ? `?email=${encodeURIComponent(typed)}` : '';
	}
</script>

<svelte:head>
	<title>Log in · Book Builder</title>
</svelte:head>

<AuthShell>
	<form
		class="stack"
		method="post"
		action="?/signInEmail"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<motion-stagger interval={0.06} delay={0.1}>
			<div class="intro">
				<h1>Welcome back.</h1>
				<p>Log in to your library, or create an account to start your first book.</p>
			</div>

			{#if data.deleted && !form}
				<p class="notice" role="status">
					<Icon name="check-circle" size={18} />
					<span>Your account has been deleted, with everything in it.</span>
				</p>
			{/if}

			<div class="field">
				<label for="email">Email</label>
				<input
					class="bb-field"
					id="email"
					type="email"
					name="email"
					autocomplete="email"
					required
					value={form?.email ?? ''}
				/>
			</div>

			<div class="field">
				<span class="label">
					<label for="password">Password</label>
					<a class="forgot" href={resolve('/forgot-password')} onclick={forgot}>Forgot it?</a>
				</span>
				<input
					class="bb-field"
					id="password"
					type="password"
					name="password"
					autocomplete="current-password"
					required
					aria-invalid={error ? 'true' : undefined}
					aria-describedby={error ? 'login-error' : undefined}
				/>
				{#if error}
					<span id="login-error" class="error" role="alert">
						<Icon name="alert-circle" size={16} />{error}
					</span>
				{/if}
			</div>

			<div class="field">
				<label for="name">Name <span class="hint">Only needed to register</span></label>
				<input
					class="bb-field"
					id="name"
					type="text"
					name="name"
					autocomplete="name"
					placeholder="How readers will see you"
				/>
			</div>

			<!-- Buttons get a plain wrapper so the cascade and their press spring animate different
			     elements. -->
			<div>
				<Button type="submit" variant="primary" size="lg" block glow disabled={submitting}>
					Log in<Icon name="arrow-right" size={18} />
				</Button>
			</div>

			<div class="divider"><span></span>New to Book Builder?<span></span></div>

			<div>
				<Button type="submit" formaction="?/signUpEmail" size="lg" block disabled={submitting}>
					Create an account
				</Button>
			</div>

			<p class="foot">
				Free and open source · <a href="https://github.com/flooyd/book-builder">View on GitHub</a>
			</p>
		</motion-stagger>
	</form>
</AuthShell>

<style>
	.label label {
		font: inherit;
		color: inherit;
	}

	/* Taller to the finger than it looks. */
	.forgot {
		margin: -12px 0;
		padding: 12px 0;
		font-weight: 500;
		font-size: 13.5px;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: 13px;
		color: var(--bb-text-4);
	}

	.divider span {
		flex: 1;
		height: 1px;
		background: var(--bb-line-soft);
	}
</style>
