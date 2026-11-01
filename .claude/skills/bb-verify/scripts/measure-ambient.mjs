// Renders every ambient sound offline in real Chrome and measures it, since nobody here can listen.
// Prints a table and writes a spectrogram sheet to ./shots. Needs the dev server. SECONDS sets how
// much to render (40 by default) and NAME the sheet's file name.
import { launch, shot, BASE, sleep } from './browser.mjs';

const seconds = Number(process.env.SECONDS ?? 40);
const browser = await launch('anon');
try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1500, height: 1500 });
	await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });

	const results = await page.evaluate(async (seconds) => {
		const { AMBIENT_SOUNDS, buildSound } = await import('/src/lib/ambient.ts');
		const RATE = 48000;

		function fft(re, im) {
			const n = re.length;
			for (let i = 1, j = 0; i < n; i++) {
				let bit = n >> 1;
				for (; j & bit; bit >>= 1) j ^= bit;
				j ^= bit;
				if (i < j) {
					[re[i], re[j]] = [re[j], re[i]];
					[im[i], im[j]] = [im[j], im[i]];
				}
			}
			for (let len = 2; len <= n; len <<= 1) {
				const ang = (-2 * Math.PI) / len;
				const wr = Math.cos(ang);
				const wi = Math.sin(ang);
				for (let i = 0; i < n; i += len) {
					let cr = 1;
					let ci = 0;
					for (let k = 0; k < len / 2; k++) {
						const ur = re[i + k];
						const ui = im[i + k];
						const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
						const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
						re[i + k] = ur + vr;
						im[i + k] = ui + vi;
						re[i + k + len / 2] = ur - vr;
						im[i + k + len / 2] = ui - vi;
						const t = cr * wr - ci * wi;
						ci = cr * wi + ci * wr;
						cr = t;
					}
				}
			}
		}

		const aWeight = (f) => {
			const f2 = f * f;
			const r =
				(12194 ** 2 * f2 * f2) /
				((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2));
			return r * r * 10 ** (2 / 10);
		};

		const db = (x) => 10 * Math.log10(Math.max(x, 1e-12));
		const out = [];
		const sheet = document.createElement('div');
		sheet.id = 'sheet';
		sheet.style.cssText = 'background:#111;color:#eee;font:13px sans-serif;padding:8px';
		document.body.replaceChildren(sheet);

		for (const { id } of AMBIENT_SOUNDS) {
			const started = performance.now();
			const context = new OfflineAudioContext(2, seconds * RATE, RATE);
			const { sound } = buildSound(context, id, context.destination);
			sound.start(0);
			const built = performance.now() - started;
			const rendered = await context.startRendering();
			const left = rendered.getChannelData(0);
			const right = rendered.getChannelData(1);

			// Skip the first second, where filters are settling.
			const skip = RATE;
			let power = 0;
			let peak = 0;
			let dc = 0;
			let cross = 0;
			let leftPower = 0;
			let rightPower = 0;
			for (let i = skip; i < left.length; i++) {
				const l = left[i];
				const r = right[i];
				power += l * l + r * r;
				leftPower += l * l;
				rightPower += r * r;
				cross += l * r;
				dc += l + r;
				peak = Math.max(peak, Math.abs(l), Math.abs(r));
			}
			const count = left.length - skip;
			const rms = Math.sqrt(power / (2 * count));
			const correlation = cross / Math.sqrt(leftPower * rightPower);

			// Biggest sample-to-sample jump relative to the rms: a click or a loop seam stands out.
			let jump = 0;
			for (let i = skip + 1; i < left.length; i++)
				jump = Math.max(jump, Math.abs(left[i] - left[i - 1]));

			// Loudness over time, in half-second steps: how much the sound moves.
			const step = RATE / 2;
			const levels = [];
			for (let at = skip; at + step < left.length; at += step) {
				let sum = 0;
				for (let i = at; i < at + step; i++) sum += left[i] * left[i] + right[i] * right[i];
				levels.push(db(sum / (2 * step)));
			}
			const swing = Math.max(...levels) - Math.min(...levels);

			// Average spectrum, A-weighted loudness, and a spectrogram.
			const size = 2048;
			const hop = 1024;
			const window = new Float64Array(size).map(
				(_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size)
			);
			const frames = Math.floor((left.length - skip - size) / hop);
			const mean = new Float64Array(size / 2);
			const columns = 1400;
			const rows = 150;
			const image = new Float32Array(columns * rows).fill(-200);
			let weighted = 0;
			const windowPower = window.reduce((sum, w) => sum + w * w, 0);
			for (let frame = 0; frame < frames; frame++) {
				const re = new Float64Array(size);
				const im = new Float64Array(size);
				const at = skip + frame * hop;
				for (let i = 0; i < size; i++) re[i] = left[at + i] * window[i];
				fft(re, im);
				const column = Math.floor((frame / frames) * columns);
				const powers = new Float64Array(size / 2);
				for (let k = 1; k < size / 2; k++) {
					const p = (re[k] * re[k] + im[k] * im[k]) / windowPower / size;
					powers[k] = p;
					mean[k] += p;
					const f = (k * RATE) / size;
					weighted += p * aWeight(f);
				}
				// Log frequency axis, 40 Hz to 16 kHz, low at the bottom, each row its nearest bin.
				for (let row = 0; row < rows; row++) {
					const f = 40 * (16000 / 40) ** (1 - row / rows);
					const k = Math.max(1, Math.round((f * size) / RATE));
					const value = db(powers[k]);
					const index = row * columns + column;
					if (value > image[index]) image[index] = value;
				}
			}
			const a = db((weighted / frames) * 2) / 1;

			// Energy in bands, as dB relative to the loudest band.
			const edges = [40, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
			const bands = edges.slice(0, -1).map((low, i) => {
				let sum = 0;
				for (let k = 1; k < size / 2; k++) {
					const f = (k * RATE) / size;
					if (f >= low && f < edges[i + 1]) sum += mean[k];
				}
				return db(sum);
			});
			const top = Math.max(...bands);

			const canvas = document.createElement('canvas');
			canvas.width = columns;
			canvas.height = rows;
			const paint = canvas.getContext('2d');
			const picture = paint.createImageData(columns, rows);
			const loudest = image.reduce((max, value) => Math.max(max, value), -200);
			for (let i = 0; i < image.length; i++) {
				const v = Math.max(0, Math.min(1, (image[i] - loudest + 62) / 62));
				picture.data[i * 4] = 255 * v ** 1.6;
				picture.data[i * 4 + 1] = 230 * v ** 2.4;
				picture.data[i * 4 + 2] = 90 + 130 * v;
				picture.data[i * 4 + 3] = 255;
			}
			paint.putImageData(picture, 0, 0);
			const label = document.createElement('div');
			label.textContent = `${id}: ${seconds - 1}s, 40 Hz to 16 kHz (log), left channel`;
			label.style.margin = '6px 0 2px';
			sheet.append(label, canvas);

			out.push({
				id,
				built: Math.round(built),
				rms: +(20 * Math.log10(rms)).toFixed(1),
				a: +a.toFixed(1),
				peak: +(20 * Math.log10(peak)).toFixed(1),
				crest: +(20 * Math.log10(peak / rms)).toFixed(1),
				dc: +(dc / (2 * count)).toFixed(5),
				corr: +correlation.toFixed(2),
				swing: +swing.toFixed(1),
				jump: +(jump / rms).toFixed(1),
				bands: bands.map((b) => Math.round(b - top))
			});
		}
		return out;
	}, seconds);

	console.log(
		'sound   build  rms    A-wtd  peak   crest  dc       corr  swing  jump/rms  bands re loudest: 63 125 250 500 1k 2k 4k 8k'
	);
	for (const r of results) {
		console.log(
			`${r.id.padEnd(7)} ${String(r.built).padStart(4)}ms ${String(r.rms).padStart(6)} ${String(r.a).padStart(6)} ${String(r.peak).padStart(6)} ${String(r.crest).padStart(5)} ${String(r.dc).padStart(8)} ${String(r.corr).padStart(5)} ${String(r.swing).padStart(5)} ${String(r.jump).padStart(7)}   ${r.bands.join(' ')}`
		);
	}
	await sleep(200);
	console.log(await shot(page, process.env.NAME ?? 'audio-sheet', { full: true }));
} finally {
	await browser.close();
}
