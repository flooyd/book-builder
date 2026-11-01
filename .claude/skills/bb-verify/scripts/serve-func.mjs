// Runs one built Vercel function from a copied folder, outside the repo, so nothing it needs can
// come from the project's node_modules. Start it from the repo root, where .env is:
//   node .claude/skills/bb-verify/scripts/serve-func.mjs "<scratch>/func/export" 5197
// It always uses the throwaway database, never the DATABASE_URL in .env.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

const [dir, port] = process.argv.slice(2);
const secret = fs
	.readFileSync('.env', 'utf8')
	.match(/^BETTER_AUTH_SECRET=(.*)$/m)?.[1]
	?.trim()
	.replace(/^"|"$/g, '');

process.chdir(dir);
process.env.BETTER_AUTH_SECRET = secret;
process.env.DATABASE_URL = 'postgres://bb@localhost:54329/bookbuilder';
process.env.ORIGIN = `http://localhost:${port}`;
process.env.BETTER_AUTH_URL = `http://localhost:${port}`;

// The handler in .vc-config.json has a broken path on a Windows build; this is the real file.
const handler = path.resolve('.svelte-kit/vercel-tmp/index.js');
const { default: run } = await import(pathToFileURL(handler).href);

http
	.createServer(async (req, res) => {
		try {
			const headers = new Headers();
			for (const [name, value] of Object.entries(req.headers)) {
				if (typeof value === 'string') headers.set(name, value);
			}
			headers.set('x-forwarded-for', '127.0.0.1');
			const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
			const response = await run.fetch(
				new Request(`http://localhost:${port}${req.url}`, {
					method: req.method,
					headers,
					...(hasBody && { body: Readable.toWeb(req), duplex: 'half' })
				})
			);
			res.statusCode = response.status;
			response.headers.forEach((value, name) => res.setHeader(name, value));
			if (response.body) Readable.fromWeb(response.body).pipe(res);
			else res.end();
		} catch (error) {
			console.error('HANDLER ERROR', error);
			res.statusCode = 500;
			res.end('handler error');
		}
	})
	.listen(Number(port), () => console.log('listening', port));
