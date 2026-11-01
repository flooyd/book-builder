<script lang="ts">
	import { resolve } from '$app/paths';
	import { ENTRY_COPY, ENTRY_TYPES, type Connection, type EntryType } from '$lib/bible';
	import { sendJSON } from '$lib/library';
	import { charactersStore, placesStore, systemsStore, type Entry } from '$lib/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	// How an entry relates to the rest of the story bible: "captain of the Meridian". A connection
	// shows on both entries' pages, with an arrow saying which way it reads.
	let {
		type,
		entry,
		connections: initial
	}: { type: EntryType; entry: Entry; connections: Connection[] } = $props();

	const uid = $props.id();
	// svelte-ignore state_referenced_locally
	let connections = $state(initial);
	let target = $state('');
	let label = $state('');
	let adding = $state(false);
	let error = $state('');

	const entries = $derived<Record<EntryType, Entry[]>>({
		character: $charactersStore,
		place: $placesStore,
		system: $systemsStore
	});

	const isSelf = (otherType: string, id: number) => otherType === type && id === entry.id;

	const rows = $derived(
		connections.flatMap((connection) => {
			const outgoing = isSelf(connection.fromType, connection.fromId);
			const otherType = (outgoing ? connection.toType : connection.fromType) as EntryType;
			const otherId = outgoing ? connection.toId : connection.fromId;
			const other = entries[otherType]?.find((e) => e.id === otherId);
			return other ? [{ connection, outgoing, otherType, other }] : [];
		})
	);

	const SUGGESTED_LABELS = ['Sister of', 'Brother of', 'Parent of', 'Rival of', 'Captain of'];

	async function add(event: SubmitEvent) {
		event.preventDefault();
		const [toType, toId] = target.split('-');
		if (!toType || !toId) {
			error = 'Choose what to connect it to.';
			return;
		}
		adding = true;
		error = '';
		try {
			const row = await sendJSON<Connection>('POST', '/api/bible/links', {
				from: { type, id: entry.id },
				to: { type: toType, id: Number(toId) },
				label
			});
			connections.push(row);
			target = '';
			label = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "Couldn't connect them.";
		} finally {
			adding = false;
		}
	}

	async function remove(id: number) {
		error = '';
		try {
			await sendJSON('DELETE', `/api/bible/links/${id}`);
			connections = connections.filter((connection) => connection.id !== id);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : "Couldn't remove that.";
		}
	}
</script>

<section class="panel" aria-labelledby="{uid}-title">
	<h2 id="{uid}-title">Connections</h2>

	{#if rows.length > 0}
		<ul>
			{#each rows as { connection, outgoing, otherType, other } (connection.id)}
				<li>
					<a href={resolve('/bible/[type]/[id]', { type: otherType, id: String(other.id) })}>
						<span class="name">{other.name}</span>
						{#if connection.label}
							<span class="label">
								<Icon name={outgoing ? 'arrow-right' : 'arrow-left'} size={13} />
								<span class="sr-only">{outgoing ? `${entry.name} is` : `${other.name} is`}</span>
								{connection.label}
								{#if !outgoing}<span class="sr-only">{entry.name}</span>{/if}
							</span>
						{/if}
					</a>
					<button
						type="button"
						class="remove"
						aria-label="Remove the connection to {other.name}"
						onclick={() => remove(connection.id)}
					>
						<Icon name="x" size={16} />
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<form onsubmit={add}>
		<label class="sr-only" for="{uid}-target">Connect to</label>
		<select id="{uid}-target" class="bb-field" bind:value={target}>
			<option value="">Connect to…</option>
			{#each ENTRY_TYPES as group (group)}
				{@const options = entries[group].filter((e) => !isSelf(group, e.id))}
				{#if options.length > 0}
					<optgroup label={ENTRY_COPY[group].many}>
						{#each options as option (option.id)}
							<option value="{group}-{option.id}">{option.name}</option>
						{/each}
					</optgroup>
				{/if}
			{/each}
		</select>
		{#if target}
			<label class="sr-only" for="{uid}-label">How they're connected</label>
			<input
				id="{uid}-label"
				class="bb-field"
				autocomplete="off"
				list="{uid}-labels"
				placeholder="e.g. Captain of"
				bind:value={label}
			/>
			<datalist id="{uid}-labels">
				{#each SUGGESTED_LABELS as suggestion (suggestion)}
					<option value={suggestion}></option>
				{/each}
			</datalist>
			<Button type="submit" disabled={adding}>
				<Icon name="plus" size={16} strokeWidth={2.2} />{adding ? 'Connecting…' : 'Connect'}
			</Button>
		{/if}
	</form>

	{#if error}
		<p class="error" role="alert"><Icon name="alert-circle" size={15} />{error}</p>
	{/if}
</section>

<style>
	h2 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 24px;
		color: var(--bb-text);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	li {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	a {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 44px;
		padding: 6px 8px;
		margin-left: -8px;
		border-radius: 10px;
		color: inherit;
		text-decoration: none;
	}

	a:hover {
		background: var(--bb-hover);
	}

	.name {
		font-weight: 600;
		font-size: 15px;
		overflow-wrap: anywhere;
	}

	.label {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 13px;
		color: var(--bb-text-3);
	}

	.remove {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin-right: -10px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-3);
	}

	.remove:hover {
		background: var(--bb-raised);
		color: var(--bb-text);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.bb-field {
		min-height: 44px;
		padding: 0 12px;
		font-size: 14.5px;
		background: var(--bb-night);
	}

	.error {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--bb-coral-soft);
	}
</style>
