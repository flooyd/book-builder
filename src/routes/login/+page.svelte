<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<h1>Login</h1>
<form method="post" action="?/signInEmail" use:enhance class="card">
	<label>
		<h2>Email</h2>
		<input type="email" name="email" />
	</label>
	<label>
		<h2>Password</h2>
		<input type="password" name="password" />
	</label>
	<label>
		<h2>Name (for registration)</h2>
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
		width: fit-content;
		padding: 9.89px;
		color: white;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 9.89px;
	}

	button {
		margin-top: 16px;
	}
</style>
