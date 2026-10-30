<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';
	import Wordmark from '$lib/components/ui/Wordmark.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ThemeToggle from '$lib/components/ui/ThemeToggle.svelte';

	let { form }: PageProps = $props();

	let submitting = $state(false);
	const error = $derived(form?.message);
</script>

<svelte:head>
	<title>Log in · Book Builder</title>
</svelte:head>

<div class="login">
	<div class="theme"><ThemeToggle /></div>

	<div class="brand-panel">
		<a class="brand" href={resolve('/')}><Wordmark size={26} /></a>

		<motion-reveal class="pitch" y={20} duration={0.8}>
			<p class="pitch-title">Pick up where <em>the last page</em> left off.</p>
			<p class="pitch-sub">
				Your books, parts, chapters, characters and systems — exactly where you shelved them.
			</p>
		</motion-reveal>

		<!-- The books drop onto the shelf one by one. Each spine sits in a plain wrapper so the drop
		     doesn't overwrite the spines' own rotate/lean transforms. -->
		<div class="shelf" aria-hidden="true">
			<motion-stagger y={-70} interval={0.09} duration={0.8} delay={0.2}>
				<div>
					<div class="spine s1"><span>The War of Nine</span><span class="num">I</span></div>
				</div>
				<div><div class="spine s2">Prologue</div></div>
				<div>
					<div class="spine s3"><span>The Ashen Coast</span><span class="num">II</span></div>
				</div>
				<div><div class="spine s4">Notes</div></div>
				<div><div class="spine s5">Tidecraft</div></div>
				<div><div class="spine s6">Characters</div></div>
			</motion-stagger>
			<div class="floor"></div>
		</div>
	</div>

	<div class="form-panel">
		<form
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
					<label for="password">Password</label>
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
	</div>
</div>

<style>
	.login {
		position: relative;
		min-height: 100vh;
		display: flex;
		flex-wrap: wrap;
		background: var(--bb-night);
	}

	/* Top right of the page: over the form on wide screens, beside the wordmark on phones. */
	.theme {
		position: absolute;
		z-index: 2;
		top: 26px;
		right: 28px;
	}

	/* Brand panel */
	.brand-panel {
		flex: 1 1 560px;
		min-width: 0;
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 48px;
		padding: 36px 48px 0;
		background: var(--bb-panel);
		border-right: 1px solid var(--bb-line-faint);
	}

	.brand {
		align-self: flex-start;
		display: inline-flex;
		text-decoration: none;
		border-radius: 8px;
	}

	.pitch {
		display: flex;
		flex-direction: column;
		gap: 18px;
		max-width: 520px;
	}

	.pitch-title {
		font-family: var(--font-display);
		font-size: clamp(40px, 4vw, 58px);
		line-height: 1.04;
		color: var(--bb-text-strong);
	}

	.pitch-title em {
		font-family: var(--font-read);
		font-style: italic;
		color: var(--bb-sky);
	}

	.pitch-sub {
		font-size: 17px;
		line-height: 1.6;
		color: var(--bb-text-2);
	}

	/* CSS bookshelf */
	.shelf {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 6px;
		padding: 0 8px;
		height: 440px;
	}

	.spine {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		border-radius: 4px 4px 2px 2px;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
	}

	.s1 {
		width: 58px;
		height: 360px;
		padding: 18px 0;
		justify-content: space-between;
		background: #1d3184;
		box-shadow:
			inset 0 0 0 1px rgba(124, 180, 255, 0.35),
			inset 6px 0 0 rgba(0, 0, 0, 0.18);
		font-family: var(--font-display);
		font-size: 19px;
		color: #e4ecff;
	}

	/* Spines are objects: fixed colors in both themes, except the plain ink one (s4). */
	.s1 .num {
		font-size: 12px;
		color: #7cb4ff;
	}

	.s2 {
		width: 46px;
		height: 300px;
		background: var(--bb-paper);
		box-shadow: inset 6px 0 0 rgba(60, 40, 10, 0.12);
		font-family: var(--font-read);
		font-style: italic;
		font-size: 17px;
		color: #141c45;
	}

	.s3 {
		width: 72px;
		height: 400px;
		padding: 20px 0;
		justify-content: space-between;
		background: var(--bb-royal);
		box-shadow: inset 6px 0 0 rgba(0, 0, 0, 0.16);
		font-family: var(--font-display);
		font-size: 22px;
		color: #fff;
	}

	.s3 .num {
		font-size: 12px;
	}

	.s4 {
		width: 40px;
		height: 270px;
		background: var(--bb-ink);
		box-shadow: inset 0 0 0 1px var(--bb-line-control);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.s5 {
		width: 62px;
		height: 336px;
		background: #7cb4ff;
		box-shadow: inset 6px 0 0 rgba(0, 0, 0, 0.12);
		font-family: var(--font-display);
		font-size: 20px;
		color: #0a1440;
	}

	.s6 {
		width: 52px;
		height: 318px;
		margin-left: 40px;
		background: #142463;
		box-shadow: inset 0 0 0 1px rgba(124, 180, 255, 0.25);
		/* Leans 8deg into the gap, pivoting on its bottom-left corner. The mockup's
		   rotate(188deg) about the bottom-right corner swings it below the shelf, out of view. */
		transform: translate(-26px, 159px) rotate(-8deg) translate(26px, -159px) rotate(180deg);
		font-family: var(--font-read);
		font-style: italic;
		font-size: 17px;
		color: #a9c8ff;
	}

	.floor {
		position: absolute;
		left: -48px;
		right: -48px;
		bottom: 0;
		height: 14px;
		background: var(--bb-raised);
		border-top: 1px solid var(--bb-line-control);
	}

	/* Form */
	.form-panel {
		flex: 1 1 480px;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 48px 32px;
	}

	form {
		width: 100%;
		max-width: 420px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.intro {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 8px;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 46px;
		line-height: 1;
		color: var(--bb-text-strong);
	}

	.intro p {
		font-size: 16px;
		line-height: 1.55;
		color: var(--bb-text-2);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	label {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 14px;
		font-weight: 600;
		color: var(--bb-text-label);
	}

	.hint {
		font-weight: 500;
		color: var(--bb-text-4);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
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

	.foot {
		margin-top: 8px;
		text-align: center;
		font-size: 13.5px;
		color: var(--bb-text-4);
	}

	@media (max-width: 760px) {
		.theme {
			top: 17px;
			right: 12px;
		}

		.brand-panel {
			gap: 28px;
			padding: 24px 20px 32px;
			border-right: none;
			border-bottom: 1px solid var(--bb-line-faint);
		}

		/* Keep the form near the top on phones. */
		.shelf {
			display: none;
		}

		.form-panel {
			padding: 32px 20px 48px;
		}

		h1 {
			font-size: 38px;
		}
	}
</style>
