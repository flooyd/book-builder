<script lang='ts'>
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<h1>Login</h1>
<form method="post" action="?/signInEmail" use:enhance>
	<label>
		Email
		<input type="email" name="email" />
	</label>
	<label>
		Password
		<input type="password" name="password" />
	</label>
	<label>
		Name (for registration)
		<input name="name" />
	</label>
	<button>Login</button>
	<button formaction="?/signUpEmail">Register</button>
</form>
<p style="color: red">{form?.message ?? ''}</p>

<style>
	h1 {
		margin-bottom: 16px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		width: 300px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6.11px;
	}

	button {
		margin-top: 16px;
	}
</style>
