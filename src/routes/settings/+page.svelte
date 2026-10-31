<script lang="ts">
	import type { PageProps } from './$types';
	import SettingsPage from '$lib/components/profile/SettingsPage.svelte';

	let { data }: PageProps = $props();
</script>

<SettingsPage
	name={data.user?.name ?? ''}
	email={data.email}
	profile={data.profile}
	sharedBooks={data.sharedBooks}
/>
