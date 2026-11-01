// Renders pages of a PDF with pdf.js in Chrome into contact sheets: node pdf-sheet.mjs file.pdf name 1-6 [perRow] [width]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { launch, sleep } from './browser.mjs';
const [file, name, range, perRow = '3', width = '460'] = process.argv.slice(2);
const dir = import.meta.dirname;
const server = http
	.createServer((req, res) => {
		const url = req.url.split('?')[0];
		if (url === '/') {
			res.setHeader('content-type', 'text/html');
			return res.end(
				'<!doctype html><body style="margin:0;background:#777"><div id=g style="display:grid;gap:10px;padding:10px"></div>'
			);
		}
		if (url === '/doc.pdf') return res.end(fs.readFileSync(path.resolve(file)));
		const p = path.join(dir, 'node_modules/pdfjs-dist/build', path.basename(url));
		if (!fs.existsSync(p)) {
			res.statusCode = 404;
			return res.end();
		}
		res.setHeader('content-type', 'text/javascript');
		res.end(fs.readFileSync(p));
	})
	.listen(0);
const port = server.address().port;
const browser = await launch('anon');
try {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.log('pageerror', e.message));
	await page.setViewport({ width: Number(perRow) * (Number(width) + 10) + 10, height: 900 });
	await page.goto(`http://localhost:${port}/`);
	const count = await page.evaluate(
		async (perRow, width, range) => {
			const lib = await import('/pdf.mjs');
			lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
			const pdf = await lib.getDocument({ url: '/doc.pdf' }).promise;
			const g = document.getElementById('g');
			g.style.gridTemplateColumns = `repeat(${perRow}, ${width}px)`;
			const [a, b] = range.split('-').map(Number);
			for (let n = a; n <= Math.min(b ?? a, pdf.numPages); n++) {
				const p = await pdf.getPage(n);
				const v = p.getViewport({ scale: width / p.getViewport({ scale: 1 }).width });
				const c = document.createElement('canvas');
				c.width = v.width;
				c.height = v.height;
				g.append(c);
				await p.render({ canvasContext: c.getContext('2d'), viewport: v, canvas: c }).promise;
			}
			return pdf.numPages;
		},
		perRow,
		Number(width),
		range
	);
	await sleep(200);
	const target = path.join(dir, 'shots', `${name}.png`);
	await page.screenshot({ path: target, fullPage: true });
	console.log(`${count} pages in the PDF; sheet at ${target}`);
} finally {
	await browser.close();
	server.close();
}
