// Ambient sound for focus mode. Nothing here is a recording: the browser makes each sound as it
// plays, from noise shaped by filters and from short events (raindrops, crackles, bubbles,
// crickets) written into buffers that loop. So there's nothing to download or license. A sound's
// layers loop at different lengths, which keeps it from ever quite repeating, and a sound is seeded,
// so it's always the same one that was measured.

export const AMBIENT_SOUNDS = [
	{ id: 'rain', label: 'Rain' },
	{ id: 'fire', label: 'Fire' },
	{ id: 'sea', label: 'Sea' },
	{ id: 'wind', label: 'Wind' },
	{ id: 'stream', label: 'Stream' },
	{ id: 'night', label: 'Night' },
	{ id: 'brown', label: 'Brown noise' }
] as const;

export type AmbientSound = (typeof AMBIENT_SOUNDS)[number]['id'];

export const isAmbientSound = (value: unknown): value is AmbientSound =>
	AMBIENT_SOUNDS.some((sound) => sound.id === value);

// Each sound trimmed to the same A-weighted loudness at full level (-20 dB, and -22 for night,
// whose crickets are tones and carry further than noise), so a mix starts balanced. Measured from
// offline renders: re-measure after changing a recipe.
const TRIM: Record<AmbientSound, number> = {
	rain: 0.312,
	fire: 0.631,
	sea: 0.272,
	wind: 0.479,
	stream: 0.556,
	night: 0.724,
	brown: 0.24
};

const TAU = Math.PI * 2;

type Colour = 'white' | 'pink' | 'brown';

/** A small seeded generator (mulberry32). */
function seeded(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

/** Noise of a colour, with no offset and an RMS level of 1. */
function colouredNoise(colour: Colour, length: number, random: () => number) {
	const samples = new Float32Array(length);
	// Pink noise by Paul Kellet's filter; brown by a leaky running total.
	let [b0, b1, b2, b3, b4, b5, b6] = [0, 0, 0, 0, 0, 0, 0];
	let total = 0;
	for (let i = 0; i < length; i++) {
		const white = random() * 2 - 1;
		if (colour === 'white') {
			samples[i] = white;
		} else if (colour === 'brown') {
			total = (total + 0.02 * white) / 1.02;
			samples[i] = total;
		} else {
			b0 = 0.99886 * b0 + white * 0.0555179;
			b1 = 0.99332 * b1 + white * 0.0750759;
			b2 = 0.969 * b2 + white * 0.153852;
			b3 = 0.8665 * b3 + white * 0.3104856;
			b4 = 0.55 * b4 + white * 0.5329522;
			b5 = -0.7616 * b5 - white * 0.016898;
			samples[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
			b6 = white * 0.115926;
		}
	}
	let sum = 0;
	for (let i = 0; i < length; i++) sum += samples[i];
	const mean = sum / length;
	let power = 0;
	for (let i = 0; i < length; i++) {
		samples[i] -= mean;
		power += samples[i] * samples[i];
	}
	const scale = 1 / Math.sqrt(power / length);
	for (let i = 0; i < length; i++) samples[i] *= scale;
	return samples;
}

/** Seconds of each colour. Unrelated lengths, so sounds sharing them never fall into step. */
const NOISE_SECONDS: Record<Colour, number> = { white: 11, pink: 13, brown: 17 };
const NOISE_SEAM = 0.5;

/** Stereo noise that loops without a seam: its end is faded into its beginning. */
function noiseBuffer(context: BaseAudioContext, colour: Colour) {
	const random = seeded(colour.length * 7919);
	const length = Math.round(NOISE_SECONDS[colour] * context.sampleRate);
	const seam = Math.round(NOISE_SEAM * context.sampleRate);
	const buffer = context.createBuffer(2, length, context.sampleRate);
	for (let channel = 0; channel < 2; channel++) {
		const raw = colouredNoise(colour, length + seam, random);
		const samples = buffer.getChannelData(channel);
		samples.set(raw.subarray(0, length));
		// Unrelated signals: equal power, not equal gain, or the level dips across the join.
		for (let i = 0; i < seam; i++) {
			const fade = i / seam;
			samples[i] = raw[i] * Math.sqrt(fade) + raw[length + i] * Math.sqrt(1 - fade);
		}
	}
	return buffer;
}

/** A short event: the value at `t` seconds after it starts. */
type Grain = (t: number) => number;

/** Put a grain into a loop at `at` seconds, panned from -1 to 1. */
type PlaceGrain = (at: number, seconds: number, pan: number, gain: number, grain: Grain) => void;

type Paint = (place: PlaceGrain, random: () => number, seconds: number) => void;

/** Events in a stereo loop. One that runs off the end comes back in at the start: no seam. */
function eventBuffer(context: BaseAudioContext, seconds: number, seed: number, paint: Paint) {
	const rate = context.sampleRate;
	const length = Math.round(seconds * rate);
	const buffer = context.createBuffer(2, length, rate);
	const left = buffer.getChannelData(0);
	const right = buffer.getChannelData(1);
	const place: PlaceGrain = (at, grainSeconds, pan, gain, grain) => {
		const start = Math.floor(at * rate);
		const count = Math.ceil(grainSeconds * rate);
		const angle = ((pan + 1) * Math.PI) / 4;
		const leftGain = Math.cos(angle) * gain;
		const rightGain = Math.sin(angle) * gain;
		for (let i = 0; i < count; i++) {
			const value = grain(i / rate);
			const index = (start + i) % length;
			left[index] += value * leftGain;
			right[index] += value * rightGain;
		}
	};
	paint(place, seeded(seed), seconds);
	return buffer;
}

/** A slow curve to drive a setting with, at a low rate, since it never moves quickly. */
function curveBuffer(
	context: BaseAudioContext,
	seconds: number,
	seed: number,
	paint: (samples: Float32Array, rate: number, random: () => number) => void
) {
	const rate = 8000;
	const buffer = context.createBuffer(1, Math.round(seconds * rate), rate);
	paint(buffer.getChannelData(0), rate, seeded(seed));
	return buffer;
}

// ---- Grains -----------------------------------------------------------------------------------

/** A tap that rings for a moment: a drop on a pane. */
const ping =
	(frequency: number, decay: number): Grain =>
	(t) =>
		Math.exp(-t / decay) * Math.sin(TAU * frequency * t);

/** A bubble rings and rises in pitch as it shrinks. */
const bubble =
	(frequency: number, decay: number, rise: number): Grain =>
	(t) =>
		Math.exp(-t / decay) * Math.sin(TAU * frequency * t * (1 + (rise * t) / decay));

/** A dry tick of noise: one crack of a burning log. */
const tick =
	(decay: number, random: () => number): Grain =>
	(t) =>
		Math.exp(-t / decay) * (random() * 2 - 1);

/** A softer knock, with some body to it. */
const pop = (decay: number, frequency: number, random: () => number): Grain => {
	return (t) =>
		Math.exp(-t / decay) * (Math.sin(TAU * frequency * t) * 0.7 + (random() - 0.5) * 0.6);
};

/** One pulse of a cricket's chirp, smooth at both ends so it doesn't click. */
const pulse =
	(frequency: number, seconds: number): Grain =>
	(t) =>
		Math.sin((Math.PI * t) / seconds) ** 2 * Math.sin(TAU * frequency * t);

// ---- Events -----------------------------------------------------------------------------------

/** Drops on a window. Most are far off and faint; now and then one lands close by. */
const patter: Paint = (place, random, seconds) => {
	for (let i = 0; i < seconds * 110; i++) {
		const close = random() ** 5;
		const decay = 0.0012 + random() * 0.004;
		const frequency = 1400 + random() * 5200;
		place(
			random() * seconds,
			decay * 7,
			random() * 1.6 - 0.8,
			0.04 + close * 0.9,
			ping(frequency, decay)
		);
	}
};

/** Crackles come in little runs from one spot in the fire, with the odd louder pop. */
const crackle: Paint = (place, random, seconds) => {
	let at = 0;
	while (at < seconds) {
		at += -Math.log(1 - random()) * 0.55;
		const pan = random() * 1.4 - 0.7;
		const count = 1 + Math.floor(random() ** 2 * 9);
		const spread = 0.02 + random() * 0.2;
		for (let i = 0; i < count; i++) {
			const decay = 0.0004 + random() * 0.0016;
			place(
				(at + random() * spread) % seconds,
				decay * 8,
				pan + random() * 0.2 - 0.1,
				0.05 + random() ** 4 * 0.6,
				tick(decay, random)
			);
		}
		if (random() < 0.18) {
			const decay = 0.008 + random() * 0.012;
			place(
				at % seconds,
				decay * 7,
				pan,
				0.18 + random() * 0.3,
				pop(decay, 350 + random() * 900, random)
			);
		}
	}
};

/** Water over stones: many small bubbles, high and quiet, and fewer large ones, low and full. */
const bubbles: Paint = (place, random, seconds) => {
	for (let i = 0; i < seconds * 110; i++) {
		const size = random() ** 2;
		const decay = 0.002 + size * 0.01;
		const frequency = 500 * 5 ** (1 - size);
		place(
			random() * seconds,
			decay * 6,
			random() * 1.4 - 0.7,
			(0.05 + size * 0.3) * (0.3 + random()),
			bubble(frequency, decay, 0.1 + random() * 0.15)
		);
	}
};

/** A few crickets, near and far, each keeping its own time. */
const crickets: Paint = (place, random, seconds) => {
	const singers = [
		{ gain: 1, pan: -0.5 },
		{ gain: 0.7, pan: 0.6 },
		{ gain: 0.5, pan: 0.15 },
		{ gain: 0.35, pan: -0.8 },
		{ gain: 0.25, pan: 0.85 }
	];
	for (const { gain, pan } of singers) {
		const frequency = 3900 + random() * 1100;
		const period = 0.55 + random() * 0.55;
		const pulses = 3 + Math.floor(random() * 2);
		let at = random() * period;
		while (at < seconds) {
			for (let i = 0; i < pulses; i++) {
				place(
					(at + i * 0.034) % seconds,
					0.018,
					pan,
					gain * (0.8 + random() * 0.2),
					pulse(frequency, 0.018)
				);
			}
			at += period * (0.92 + random() * 0.16);
		}
	}
};

/** Waves arriving: each climbs to where it breaks, then its wash drains away. Wraps at the end. */
function paintWaves(samples: Float32Array, rate: number, random: () => number) {
	const seconds = samples.length / rate;
	let at = random() * 4;
	while (at < seconds) {
		const height = 0.55 + random() * 0.45;
		const rise = 2.2 + random() * 1.6;
		const fall = 3 + random() * 2.6;
		const length = Math.round((rise + fall * 6) * rate);
		const start = Math.floor(at * rate);
		for (let i = 0; i < length; i++) {
			const t = i / rate;
			const value = t < rise ? (t / rise) ** 2 : Math.exp(-(t - rise) / fall);
			samples[(start + i) % samples.length] += height * value;
		}
		at += 7 + random() * 6;
	}
}

// ---- Recipes ----------------------------------------------------------------------------------

/** The pieces a recipe is built from. Keeps what must be started and stopped together. */
class Kit {
	#context: BaseAudioContext;
	#sources: { node: AudioScheduledSourceNode; offset?: number }[] = [];
	#random: () => number;
	/** Where a recipe's layers end up. */
	readonly output: AudioNode;

	constructor(context: BaseAudioContext, output: AudioNode, seed: number) {
		this.#context = context;
		this.output = output;
		this.#random = seeded(seed);
	}

	#cached(name: string, make: () => AudioBuffer) {
		const made = (buffers.get(this.#context) ?? {}) as Record<string, AudioBuffer>;
		buffers.set(this.#context, made);
		return (made[name] ??= make());
	}

	#loop(buffer: AudioBuffer, startAnywhere = true) {
		const node = this.#context.createBufferSource();
		node.buffer = buffer;
		node.loop = true;
		this.#sources.push({ node, offset: startAnywhere ? this.#random() * buffer.duration : 0 });
		return node;
	}

	/** Looping noise, starting somewhere of its own so that two layers never line up. */
	noise(colour: Colour) {
		return this.#loop(this.#cached(colour, () => noiseBuffer(this.#context, colour)));
	}

	events(name: string, seconds: number, seed: number, paint: Paint) {
		return this.#loop(this.#cached(name, () => eventBuffer(this.#context, seconds, seed, paint)));
	}

	curve(
		name: string,
		seconds: number,
		seed: number,
		paint: (samples: Float32Array, rate: number, random: () => number) => void
	) {
		return this.#loop(
			this.#cached(name, () => curveBuffer(this.#context, seconds, seed, paint)),
			false
		);
	}

	filter(type: BiquadFilterType, frequency: number, Q = 0.7) {
		const node = this.#context.createBiquadFilter();
		node.type = type;
		node.frequency.value = frequency;
		node.Q.value = Q;
		return node;
	}

	gain(value: number) {
		const node = this.#context.createGain();
		node.gain.value = value;
		return node;
	}

	pan(value: number) {
		const node = this.#context.createStereoPanner();
		node.pan.value = value;
		return node;
	}

	oscillator(frequency: number) {
		const node = this.#context.createOscillator();
		node.frequency.value = frequency;
		this.#sources.push({ node });
		return node;
	}

	/** Slow wandering between -1 and 1: rates with no common beat, so it never comes round again. */
	drift(...rates: number[]) {
		const sum = this.gain(1 / rates.length);
		for (const rate of rates) this.oscillator(rate).connect(sum);
		return sum;
	}

	/** Connect each to the next. The last may be a setting, for one layer to steer another. */
	chain(...links: [AudioNode, ...(AudioNode | AudioParam)[]]) {
		links.reduce((from, to) => {
			(from as AudioNode).connect(to as AudioNode);
			return to;
		});
	}

	start(when: number) {
		for (const { node, offset } of this.#sources) {
			if (offset !== undefined) (node as AudioBufferSourceNode).start(when, offset);
			else node.start(when);
		}
	}

	stop(when: number) {
		for (const { node } of this.#sources) node.stop(when);
	}

	/** Runs once every source has stopped. */
	set onended(listener: () => void) {
		const last = this.#sources.at(-1)?.node;
		if (last) last.onended = listener;
	}
}

const buffers = new WeakMap<BaseAudioContext, object>();

/** One half of the sea: a line of waves on one side, loud and bright as each one breaks. */
function surf(sound: Kit, name: string, seconds: number, seed: number, pan: number) {
	const swell = sound.curve(name, seconds, seed, paintWaves);
	const wash = sound.filter('lowpass', 420, 0.4);
	const level = sound.gain(0);
	sound.chain(sound.noise('pink'), wash, level, sound.pan(pan), sound.output);
	sound.chain(swell, sound.gain(0.8), level.gain);
	sound.chain(swell, sound.gain(3200), wash.frequency);
}

/** One side of the wind: a gust is louder and higher, so one drift steers both. */
function gusts(sound: Kit, pan: number, ...rates: number[]) {
	const drift = sound.drift(...rates);
	const band = sound.filter('bandpass', 430, 1.1);
	const level = sound.gain(0.55);
	sound.chain(sound.noise('pink'), band, level, sound.pan(pan), sound.output);
	sound.chain(drift, sound.gain(190), band.frequency);
	sound.chain(drift, sound.gain(0.38), level.gain);

	// A thin whistle in the same gusts.
	const whistle = sound.filter('bandpass', 1150, 10);
	sound.chain(sound.noise('pink'), whistle, sound.gain(0.1), sound.pan(pan), sound.output);
	sound.chain(drift, sound.gain(260), whistle.frequency);
}

const RECIPES: Record<AmbientSound, (sound: Kit) => void> = {
	rain(sound) {
		// The hiss of a lot of rain, its body on a roof, a little weight below, and near drops.
		const hiss = sound.gain(0.34);
		sound.chain(
			sound.noise('white'),
			sound.filter('highpass', 1400),
			sound.filter('lowpass', 9000),
			hiss,
			sound.output
		);
		sound.chain(
			sound.noise('pink'),
			sound.filter('bandpass', 620, 0.6),
			sound.gain(0.5),
			sound.output
		);
		sound.chain(sound.noise('brown'), sound.filter('lowpass', 170), sound.gain(0.12), sound.output);
		sound.chain(
			sound.events('patter', 9.7, 11, patter),
			sound.filter('highpass', 700),
			sound.gain(0.6),
			sound.output
		);
		// Heavier and lighter, slowly.
		sound.chain(sound.drift(0.031, 0.047, 0.083), sound.gain(0.1), hiss.gain);
	},

	fire(sound) {
		// A low, unsteady roar, the breath of the flames, and the crackle on top.
		const roar = sound.gain(0.4);
		sound.chain(sound.noise('brown'), sound.filter('lowpass', 300), roar, sound.output);
		sound.chain(sound.drift(0.6, 1.4, 2.7), sound.gain(0.14), roar.gain);
		const breath = sound.gain(0.3);
		sound.chain(sound.noise('pink'), sound.filter('bandpass', 800, 0.5), breath, sound.output);
		sound.chain(sound.drift(0.3, 0.9, 1.9), sound.gain(0.11), breath.gain);
		sound.chain(
			sound.events('crackle', 23.3, 23, crackle),
			sound.filter('highpass', 350),
			sound.gain(2),
			sound.output
		);
	},

	sea(sound) {
		// The deep of it under everything, and two lines of waves that drift in and out of step.
		sound.chain(sound.noise('brown'), sound.filter('lowpass', 220), sound.gain(0.3), sound.output);
		surf(sound, 'waves-left', 47.3, 31, -0.45);
		surf(sound, 'waves-right', 61.7, 37, 0.45);
	},

	wind(sound) {
		gusts(sound, -0.5, 0.043, 0.071, 0.13);
		gusts(sound, 0.5, 0.037, 0.089, 0.11);
	},

	stream(sound) {
		// Running water's hush and low weight, under the bubbles that make it sound like water.
		sound.chain(
			sound.noise('pink'),
			sound.filter('bandpass', 1400, 0.5),
			sound.gain(0.3),
			sound.output
		);
		sound.chain(sound.noise('brown'), sound.filter('lowpass', 300), sound.gain(0.07), sound.output);
		sound.chain(sound.events('bubbles', 13.1, 13, bubbles), sound.gain(2.4), sound.output);
	},

	night(sound) {
		// Still air, crickets near by, and far ones too many to tell apart.
		const air = sound.gain(0.14);
		sound.chain(
			sound.noise('pink'),
			sound.filter('highpass', 140),
			sound.filter('lowpass', 1400),
			air,
			sound.output
		);
		sound.chain(sound.drift(0.04, 0.09), sound.gain(0.04), air.gain);
		sound.chain(sound.events('crickets', 19.3, 19, crickets), sound.gain(0.7), sound.output);
		const chorus = sound.gain(0.02);
		sound.chain(sound.noise('white'), sound.filter('bandpass', 4700, 8), chorus, sound.output);
		sound.chain(sound.oscillator(16), sound.gain(0.012), chorus.gain);
	},

	brown(sound) {
		sound.chain(sound.noise('brown'), sound.filter('lowpass', 900, 0.5), sound.output);
	}
};

/** One sound, wired into `output` and ready to start. Works on an offline context too. */
export function buildSound(context: BaseAudioContext, id: AmbientSound, output: AudioNode) {
	const trim = context.createGain();
	trim.gain.value = TRIM[id];
	trim.connect(output);
	const seed = AMBIENT_SOUNDS.findIndex((sound) => sound.id === id) + 1;
	const sound = new Kit(context, trim, seed * 1009);
	RECIPES[id](sound);
	return { sound, trim };
}

/** Takes the top off a full mix, gently, rather than letting it clip. Clean below about -3 dB. */
function softLimit(context: BaseAudioContext) {
	const reach = 4;
	const knee = 0.7;
	const curve = new Float32Array(8192);
	for (let i = 0; i < curve.length; i++) {
		const input = ((i / (curve.length - 1)) * 2 - 1) * reach;
		const size = Math.abs(input);
		const output = size < knee ? size : knee + 0.29 * Math.tanh((size - knee) / 0.29);
		curve[i] = Math.sign(input) * output;
	}
	const before = context.createGain();
	before.gain.value = 1 / reach;
	const shaper = context.createWaveShaper();
	shaper.curve = curve;
	before.connect(shaper);
	return { input: before, output: shaper };
}

const FADE_IN = 0.5;
const FADE_OUT = 0.2;
const GLIDE = 0.04;

/** A slider's 0 to 1, as gain: we hear level as a curve, so a straight line would bunch up. */
const gainFor = (level: number) => level * level;

/**
 * The sounds playing now. Browsers only let audio start from a tap or a key press, so the first
 * `play` should come from one; `resume` picks up anything that was held back.
 */
export class AmbientMixer {
	#context: AudioContext | undefined;
	#input: GainNode | undefined;
	#voices: Partial<Record<AmbientSound, { sound: Kit; level: GainNode }>> = {};

	#open() {
		if (this.#context && this.#input) return { context: this.#context, input: this.#input };
		const context = new AudioContext({ latencyHint: 'playback' });
		const input = context.createGain();
		const limit = softLimit(context);
		input.connect(limit.input);
		limit.output.connect(context.destination);
		this.#context = context;
		this.#input = input;
		return { context, input };
	}

	/** Start a sound with a slow fade, or if it's playing, glide to the new level. */
	play(id: AmbientSound, level: number) {
		const { context, input } = this.#open();
		const now = context.currentTime;
		const playing = this.#voices[id];
		if (playing) {
			playing.level.gain.setTargetAtTime(gainFor(level), now, GLIDE);
			return;
		}
		const gain = context.createGain();
		gain.gain.value = 0;
		gain.connect(input);
		const { sound } = buildSound(context, id, gain);
		sound.start(now);
		gain.gain.setTargetAtTime(gainFor(level), now, FADE_IN);
		this.#voices[id] = { sound, level: gain };
		this.resume();
	}

	stop(id: AmbientSound) {
		const voice = this.#voices[id];
		if (!voice || !this.#context) return;
		delete this.#voices[id];
		const now = this.#context.currentTime;
		voice.level.gain.setTargetAtTime(0, now, FADE_OUT);
		voice.sound.onended = () => voice.level.disconnect();
		voice.sound.stop(now + FADE_OUT * 6);
	}

	/** Start again if the browser held the sound back or suspended it. */
	resume() {
		if (this.#context?.state === 'suspended') this.#context.resume().catch(() => {});
	}

	/** Fade everything out and let go of the audio device. */
	close() {
		const context = this.#context;
		if (!context || !this.#input) return;
		this.#input.gain.setTargetAtTime(0, context.currentTime, FADE_OUT / 2);
		this.#context = undefined;
		this.#input = undefined;
		this.#voices = {};
		setTimeout(() => context.close().catch(() => {}), FADE_OUT * 3000);
	}
}
