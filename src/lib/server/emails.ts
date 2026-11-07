import type { Email } from './email';

// The emails Book Builder sends, drawn like the app: the wordmark, then one paper card with a
// heading, a line or two and a royal button. Email clients ignore most CSS, so it's tables and
// inline styles, with Gloock and Schibsted Grotesk where a client loads web fonts (Apple Mail,
// iOS) and Georgia and the system sans where it doesn't (Gmail). Clients that follow the reader's
// dark mode get the night colours; the rest keep paper.

type Letter = {
	subject: string;
	/** The line an inbox shows after the subject. */
	preheader: string;
	overline: string;
	heading: string;
	paragraphs: string[];
	button: { label: string; url: string };
	/** Smaller words under the button: how long the link lasts, what to do if it wasn't you. */
	note: string;
};

const SERIF = "Gloock, Georgia, 'Times New Roman', serif";
const SANS = "'Schibsted Grotesk', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const escape = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

/** The site the email's link is on, for the logo and the wordmark: Better Auth builds the link
 * from ORIGIN, or from the request when ORIGIN isn't set, so it's right either way. */
const origin = (link: string) => {
	try {
		return new URL(link).origin;
	} catch {
		return '';
	}
};
/** "Hi Juno," from Juno Halley: a first name reads like a person wrote it. */
const greeting = (name: string) => {
	const first = name.trim().split(/\s+/)[0];
	return first ? `Hi ${first},` : 'Hello,';
};

/** The link that confirms a new account's email. */
export function verifyEmail(user: { name: string; email: string }, url: string): Email {
	return letter(user.email, {
		subject: 'Confirm your email for Book Builder',
		preheader: 'One click and your library is open.',
		overline: 'Welcome',
		heading: 'Confirm your email',
		paragraphs: [
			`${greeting(user.name)} thanks for making an account. Confirm this is your email address and your library will be ready for your first book.`
		],
		button: { label: 'Confirm my email', url },
		note: "The link works for the next 24 hours. If you didn't make an account, ignore this email and nothing will happen."
	});
}

/** The link to choose a new password. */
export function resetPasswordEmail(user: { name: string; email: string }, url: string): Email {
	return letter(user.email, {
		subject: 'Choose a new password for Book Builder',
		preheader: 'The link works for the next hour.',
		overline: 'Your account',
		heading: 'Choose a new password',
		paragraphs: [
			`${greeting(user.name)} someone asked to reset the password for your Book Builder account. If it was you, choose a new one here.`
		],
		button: { label: 'Choose a new password', url },
		note: "The link works once, for the next hour. If you didn't ask for this, ignore this email: your password stays as it is."
	});
}

function letter(to: string, content: Letter): Email {
	return { to, subject: content.subject, html: html(to, content), text: text(content) };
}

function text(content: Letter) {
	return [
		content.heading,
		...content.paragraphs,
		`${content.button.label}:\n${content.button.url}`,
		content.note,
		'Book Builder'
	].join('\n\n');
}

function html(to: string, content: Letter) {
	const url = escape(content.button.url);
	const home = origin(content.button.url);
	const host = home.replace(/^https?:\/\//, '');
	const paragraphs = content.paragraphs
		.map(
			(paragraph) =>
				`<p class="bb-text" style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:#283058;">${escape(paragraph)}</p>`
		)
		.join('');

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escape(content.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Gloock&family=Schibsted+Grotesk:wght@400;600&display=swap" rel="stylesheet">
<style>
body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
@media (prefers-color-scheme: dark) {
	.bb-ground { background: #0a0f24 !important; }
	.bb-card { background: #10173a !important; border-color: #1e2852 !important; }
	.bb-strong { color: #f4f6ff !important; }
	.bb-text { color: #d5dcf3 !important; }
	.bb-muted { color: #8d98c2 !important; }
	.bb-sky { color: #7cb4ff !important; }
	.bb-rule { border-color: #1e2852 !important; }
}
@media (max-width: 520px) {
	.bb-card { padding: 30px 22px 26px !important; }
	.bb-heading { font-size: 27px !important; }
}
</style>
</head>
<body class="bb-ground" style="margin:0;padding:0;background:#f5f0e6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escape(content.preheader)}${'&#8199;&#847;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bb-ground" style="background:#f5f0e6;">
<tr><td align="center" style="padding:40px 16px 48px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
<tr><td style="padding:0 4px 22px;">
<a href="${escape(home || '#')}" style="text-decoration:none;">
<img src="${escape(home)}/email/mark.png" width="30" height="30" alt="" style="display:inline-block;width:30px;height:30px;border:0;vertical-align:middle;">
<span class="bb-strong" style="font-family:${SERIF};font-size:23px;line-height:30px;color:#10173a;vertical-align:middle;margin-left:10px;"><span class="bb-sky" style="color:#2152d8;">B</span>ook <span class="bb-sky" style="color:#2152d8;">B</span>uilder</span>
</a>
</td></tr>
<tr><td class="bb-card" style="background:#fdfbf7;border:1px solid #e1d9c9;border-radius:20px;padding:38px 40px 34px;">
<p class="bb-sky" style="margin:0 0 10px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#2152d8;">${escape(content.overline)}</p>
<h1 class="bb-strong bb-heading" style="margin:0 0 18px;font-family:${SERIF};font-weight:400;font-size:32px;line-height:1.12;color:#10173a;">${escape(content.heading)}</h1>
${paragraphs}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 26px;">
<tr><td style="border-radius:12px;background:#2b63f5;">
<a href="${url}" style="display:inline-block;padding:14px 26px;font-family:${SANS};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:12px;">${escape(content.button.label)}&nbsp;&rarr;</a>
</td></tr>
</table>
<p class="bb-muted" style="margin:0;font-family:${SANS};font-size:14px;line-height:1.55;color:#4a527d;">${escape(content.note)}</p>
<p class="bb-muted bb-rule" style="margin:26px 0 0;padding-top:18px;border-top:1px solid #e8e1d3;font-family:${SANS};font-size:12.5px;line-height:1.5;color:#535a86;">Button not working? Paste this link into your browser:<br><a class="bb-sky" href="${url}" style="color:#2152d8;word-break:break-all;">${url}</a></p>
</td></tr>
<tr><td class="bb-muted" style="padding:22px 4px 0;font-family:${SANS};font-size:12.5px;line-height:1.55;color:#535a86;">
Book Builder, a free and open-source workshop for long-form stories.<br>Sent to ${escape(to)}${host ? ` from ${escape(host)}` : ''}.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
