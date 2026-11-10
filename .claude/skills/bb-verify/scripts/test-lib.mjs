// Run tests on Book Builder's own modules without a test runner in the repo.
//
//   node .claude/skills/bb-verify/scripts/test-lib.mjs <test file> [more test files]
//
// Each test file is ordinary TypeScript that uses node:test and node:assert and imports what it
// tests from '$lib/...', the way the app does. esbuild (already in node_modules, through
// drizzle-kit) bundles each one with $lib pointing at src/lib, and Node runs the bundles.
//
// It suits the modules that only import each other and packages: rich.ts, bible.ts, diff.ts,
// insights.ts, speakers.ts, connections.ts, goals.ts, story-versions.ts, headings.ts and the
// like. Anything that imports $app/..., $env/... or a .svelte file needs the dev server instead.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
// Inside node_modules, so git never sees it and the packages a module imports are found.
const out = path.join(repo, 'node_modules/.cache/bb-test');

const files = process.argv.slice(2).map((file) => path.resolve(file));
if (!files.length) {
	console.error('Give it at least one test file, e.g. <scratch>/tests/rich.test.ts');
	process.exit(2);
}

let build;
try {
	({ build } = await import('esbuild'));
} catch {
	console.error('esbuild is missing from node_modules. Run `yarn install` in the repo first.');
	process.exit(2);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const bundles = [];
for (const [index, file] of files.entries()) {
	const outfile = path.join(out, `${index}-${path.basename(file).replace(/\.[^.]+$/, '')}.mjs`);
	try {
		await build({
			entryPoints: [file],
			outfile,
			bundle: true,
			platform: 'node',
			format: 'esm',
			target: 'node24',
			sourcemap: 'inline',
			// The app's own modules are bundled in; packages are loaded from node_modules when it runs.
			alias: { $lib: path.join(repo, 'src/lib') },
			packages: 'external',
			logLevel: 'warning'
		});
	} catch {
		// esbuild has already printed what was wrong.
		process.exit(1);
	}
	bundles.push(outfile);
}

const run = spawnSync(process.execPath, ['--enable-source-maps', '--test', ...bundles], {
	stdio: 'inherit',
	cwd: repo
});
process.exit(run.status ?? 1);
