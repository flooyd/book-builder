// Helpers for driving Book Builder's dev server with headless Chrome (puppeteer-core) in a
// throwaway profile. Copy this file into a scratch folder that has puppeteer-core installed
// (`npm i puppeteer-core`) and import it from your test scripts there.
//
//   import { launch, watch, shot, overflow, ensureSignedIn, freeze, BASE, sleep } from './browser.mjs';
//
// BASE defaults to http://localhost:5199 (override with BB_BASE). Screenshots go to ./shots
// (override with BB_SHOTS). CHROME overrides the browser path.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

export const BASE = process.env.BB_BASE ?? 'http://localhost:5199';
export const OUT = path.resolve(process.env.BB_SHOTS ?? path.join(import.meta.dirname, 'shots'));
fs.mkdirSync(OUT, { recursive: true });

const CHROMES = [
	process.env.CHROME,
	'C:/Program Files/Google/Chrome/Application/chrome.exe',
	'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium'
].filter(Boolean);

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** profile 'anon' stays signed out; 'auth' keeps the test user's session between runs. */
export async function launch(profile = 'anon') {
	const executablePath = CHROMES.find((file) => fs.existsSync(file));
	if (!executablePath) throw new Error('No Chrome found; set CHROME to its path.');
	return puppeteer.launch({
		executablePath,
		headless: true,
		userDataDir: path.join(import.meta.dirname, `chrome-${profile}`),
		args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars']
	});
}

/** Collects console warnings and errors, page errors, failed requests and 4xx/5xx responses. */
export function watch(page, label) {
	const problems = [];
	page.on('console', (message) => {
		const type = message.type();
		// Lit's dev-mode notice comes from motion-components in dev; it isn't ours.
		if (
			(type === 'error' || type === 'warn' || type === 'warning') &&
			!message.text().includes('Lit is in dev mode')
		) {
			problems.push(`[${label}] console.${type}: ${message.text()}`);
		}
	});
	page.on('pageerror', (error) => problems.push(`[${label}] pageerror: ${error.message}`));
	page.on('requestfailed', (request) => {
		if (!request.url().includes('fonts.g')) {
			problems.push(`[${label}] requestfailed: ${request.url()} ${request.failure()?.errorText}`);
		}
	});
	page.on('response', (response) => {
		if (response.status() >= 400) {
			problems.push(
				`[${label}] HTTP ${response.status()} ${response.request().method()} ${response.url()}`
			);
		}
	});
	return problems;
}

/** Saves a screenshot to OUT/<name>.png once fonts are in; returns the path. */
export async function shot(page, name, { full = false } = {}) {
	await page.evaluate(() => document.fonts.ready);
	const file = path.join(OUT, `${name}.png`);
	await page.screenshot({ path: file, fullPage: full });
	return file;
}

/** Null if nothing scrolls sideways; otherwise the widest offenders. */
export async function overflow(page) {
	return page.evaluate(() => {
		const root = document.documentElement;
		if (root.scrollWidth <= root.clientWidth + 1) return null;
		const wide = [];
		for (const element of document.querySelectorAll('body *')) {
			const rect = element.getBoundingClientRect();
			if (rect.right > root.clientWidth + 1 && getComputedStyle(element).position !== 'fixed') {
				wide.push(
					`${element.tagName.toLowerCase()}.${[...element.classList].join('.')} right=${Math.round(rect.right)}`
				);
			}
			if (wide.length > 8) break;
		}
		return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, wide };
	});
}

/** Pauses every CSS animation under `selector` at `seconds`, for a steady screenshot. */
export async function freeze(page, selector, seconds) {
	await page.evaluate(
		(selector, ms) => {
			for (const animation of document.getAnimations()) {
				if (!animation.effect?.target?.closest?.(selector)) continue;
				animation.pause();
				animation.currentTime = ms;
			}
		},
		selector,
		seconds * 1000
	);
}

export const TEST_USER = {
	name: 'Wren Test',
	email: 'wren@example.test',
	password: 'correct-horse-battery'
};

/** Signs the test user in on the throwaway database, signing them up the first time. */
export async function ensureSignedIn(page) {
	await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
	if (!page.url().includes('/login')) return; // already signed in
	await page.type('input[name=email]', TEST_USER.email);
	await page.type('input[name=password]', TEST_USER.password);
	await page.type('input[name=name]', TEST_USER.name);
	await Promise.all([
		page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
		page.click('button[formaction="?/signUpEmail"]')
	]);
	await sleep(500);
	if (page.url().includes('/login')) {
		// Already registered: sign in instead (the form's default action).
		await Promise.all([
			page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
			page.click('button:not([formaction])')
		]);
		await sleep(500);
	}
	if (page.url().includes('/login')) throw new Error('Could not sign the test user in.');
}
