import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { verification } from '$lib/server/db/schema';

// Email goes out through Resend's API: one HTTPS request per email, and only when someone signs
// up, asks for a new link or forgets their password. Without RESEND_API_KEY, the dev server prints
// each email to the terminal instead, so the links can be followed locally.

/** Resend only sends from a domain verified in its dashboard; resend.dev reaches the owner alone. */
const from = () => env.EMAIL_FROM || 'Book Builder <onboarding@resend.dev>';

/** Thrown when an address or a visitor has had too many emails lately. */
export class EmailTooSoon extends Error {
	constructor() {
		super('EMAIL_TOO_SOON');
	}
}

export type Email = { to: string; subject: string; html: string; text: string };

export async function sendEmail(email: Email) {
	const address = email.to.toLowerCase();
	const visitor = visitorAddress();
	// Guards the inbox being written to and the free plan's quota (100 a day): one a minute and ten
	// a day to an address, and twenty an hour from one visitor. Only emails that went out count.
	const limits = [
		{ key: `minute:${address}`, most: 1, seconds: 60 },
		{ key: `day:${address}`, most: 10, seconds: 24 * 60 * 60 },
		...(visitor ? [{ key: `visitor:${visitor}`, most: 20, seconds: 60 * 60 }] : [])
	];
	for (const limit of limits) {
		if ((await sentSoFar(limit.key)) >= limit.most) throw new EmailTooSoon();
	}

	if (!env.RESEND_API_KEY) {
		if (!dev) throw new Error('RESEND_API_KEY is not set, so no email can be sent.');
		console.info(`\n[email] To ${email.to}: ${email.subject}\n\n${email.text}\n`);
	} else {
		const response = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: from(),
				to: [email.to],
				subject: email.subject,
				html: email.html,
				text: email.text
			})
		});
		// A 403 here usually means the sender is still onboarding@resend.dev, which only reaches the
		// Resend account's own address: verify a domain and set EMAIL_FROM.
		if (!response.ok) {
			throw new Error(
				`Resend didn't send the email (${response.status}): ${await response.text()}`
			);
		}
	}

	for (const limit of limits) await countSent(limit.key, limit.seconds);
}

function visitorAddress() {
	try {
		return getRequestEvent().getClientAddress();
	} catch {
		return null;
	}
}

// The counts live in Better Auth's verification table, so they hold across every server instance:
// a row's value is how many have gone out, and it expires with its window.
const identifierOf = (key: string) => `bb-email:${key}`;

async function current(key: string) {
	const [row] = await db
		.select({ id: verification.id, value: verification.value })
		.from(verification)
		.where(
			and(eq(verification.identifier, identifierOf(key)), gt(verification.expiresAt, new Date()))
		)
		.limit(1);
	return row;
}

async function sentSoFar(key: string) {
	return Number((await current(key))?.value) || 0;
}

async function countSent(key: string, seconds: number) {
	const row = await current(key);
	if (row) {
		await db
			.update(verification)
			.set({ value: String((Number(row.value) || 0) + 1) })
			.where(eq(verification.id, row.id));
		return;
	}
	const identifier = identifierOf(key);
	await db.delete(verification).where(eq(verification.identifier, identifier));
	await db.insert(verification).values({
		id: crypto.randomUUID(),
		identifier,
		value: '1',
		expiresAt: new Date(Date.now() + seconds * 1000)
	});
}
