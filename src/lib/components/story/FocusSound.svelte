<script lang="ts">
	import { onMount } from 'svelte';
	import { AMBIENT_SOUNDS, AmbientMixer, isAmbientSound, type AmbientSound } from '$lib/ambient';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Menu from '$lib/components/rich/Menu.svelte';

	// Ambient sound, from focus mode's bar: any mix of sounds, each at its own level. What was
	// playing comes back on the next visit to focus mode, and it all stops on leaving.
	const PREFS = 'bb-focus-sound';
	const START_LEVEL = 0.6;

	const mixer = new AmbientMixer();
	let playing = $state<AmbientSound[]>([]);
	let levels = $state<Partial<Record<AmbientSound, number>>>({});
	let prefsLoaded = false;

	const shown = $derived(AMBIENT_SOUNDS.filter((sound) => playing.includes(sound.id)));
	const summary = $derived(
		shown.length === 0
			? 'Sound'
			: shown.length === 1
				? shown[0].label
				: `${shown[0].label} + ${shown.length - 1}`
	);

	const levelOf = (id: AmbientSound) => levels[id] ?? START_LEVEL;

	function toggle(id: AmbientSound) {
		if (playing.includes(id)) {
			playing = playing.filter((sound) => sound !== id);
			mixer.stop(id);
		} else {
			playing = [...playing, id];
			mixer.play(id, levelOf(id));
		}
	}

	function setLevel(id: AmbientSound, level: number) {
		levels[id] = level;
		mixer.play(id, level);
	}

	function stopAll() {
		for (const id of playing) mixer.stop(id);
		playing = [];
	}

	$effect(() => {
		const prefs = JSON.stringify({ playing, levels });
		if (!prefsLoaded) return;
		try {
			localStorage.setItem(PREFS, prefs);
		} catch {
			// storage unavailable: settings last for this visit
		}
	});

	onMount(() => {
		try {
			const prefs = JSON.parse(localStorage.getItem(PREFS) ?? 'null');
			if (Array.isArray(prefs?.playing)) playing = prefs.playing.filter(isAmbientSound);
			for (const [id, level] of Object.entries(prefs?.levels ?? {})) {
				if (isAmbientSound(id) && typeof level === 'number') {
					levels[id] = Math.min(1, Math.max(0, level));
				}
			}
		} catch {
			// storage unavailable: defaults
		}
		prefsLoaded = true;

		// Focus mode opened from a tap, so this may play straight away. If the browser wants a
		// gesture of its own, or a phone call suspended the sound, the next key or tap wakes it.
		for (const id of playing) mixer.play(id, levelOf(id));
		const wake = () => mixer.resume();
		document.addEventListener('keydown', wake, true);
		document.addEventListener('pointerdown', wake, true);
		return () => {
			document.removeEventListener('keydown', wake, true);
			document.removeEventListener('pointerdown', wake, true);
			mixer.close();
		};
	});
</script>

<button
	type="button"
	class={['tool', { on: shown.length > 0 }]}
	popovertarget="focus-sound"
	title="Ambient sound"
	aria-label={shown.length > 0
		? `Ambient sound: ${shown.map((sound) => sound.label).join(', ')}`
		: 'Ambient sound'}
>
	<Icon name="volume" size={16} /><span class="summary">{summary}</span>
</button>
<Menu id="focus-sound" label="Ambient sound" width={280} height={600}>
	<div class="head">
		<p class="label">Ambient sound</p>
		{#if shown.length > 0}
			<button type="button" class="stop" onclick={stopAll}>Stop all</button>
		{/if}
	</div>
	<div class="sounds">
		{#each AMBIENT_SOUNDS as sound (sound.id)}
			<button
				type="button"
				aria-pressed={playing.includes(sound.id)}
				onclick={() => toggle(sound.id)}>{sound.label}</button
			>
		{/each}
	</div>
	{#each shown as sound (sound.id)}
		<label class="level">
			<span>{sound.label}</span>
			<input
				type="range"
				min="0.05"
				max="1"
				step="0.05"
				value={levelOf(sound.id)}
				oninput={(event) => setLevel(sound.id, event.currentTarget.valueAsNumber)}
			/>
		</label>
	{/each}
</Menu>

<style>
	.tool {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 12px;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--bb-text-label);
		font: 600 14px var(--font-ui);
	}

	.tool:hover {
		background: var(--bb-line-faint);
	}

	.tool.on {
		color: var(--bb-sky-text);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 28px;
		margin-bottom: 8px;
	}

	.label {
		font-size: 11.5px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bb-text-3);
	}

	.stop {
		min-height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--bb-sky-text);
		font: 600 13px var(--font-ui);
	}

	.stop:hover {
		background: var(--bb-hover);
	}

	.sounds {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 4px;
	}

	.sounds button {
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--bb-text);
		font: 500 14px var(--font-ui);
		text-align: left;
	}

	.sounds button:hover {
		background: var(--bb-hover);
	}

	.sounds button[aria-pressed='true'] {
		border-color: var(--bb-sky);
		background: var(--bb-sky-wash);
		color: var(--bb-sky-text);
	}

	.level {
		display: grid;
		grid-template-columns: 84px 1fr;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		margin-top: 4px;
		font-size: 13.5px;
		color: var(--bb-text-label);
	}

	.level:first-of-type {
		margin-top: 10px;
		padding-top: 6px;
		border-top: 1px solid var(--bb-line-soft);
	}

	.level input {
		width: 100%;
		min-width: 0;
		height: 32px;
		margin: 0;
		accent-color: var(--bb-sky);
	}

	@media (max-width: 760px) {
		/* The bar is tight on a phone: the icon says enough, and turns blue when sound is on. */
		.summary {
			display: none;
		}
	}
</style>
