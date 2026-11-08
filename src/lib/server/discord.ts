import { env } from '$env/dynamic/private';

// Fire a notification to the project Discord via an incoming webhook.
//
// Optional by design: if DISCORD_WEBHOOK_URL is unset (local dev, preview
// deploys) this is a SILENT no-op — there is nothing to notify and no error.
//
// A webhook outage must never break the user-facing flow that triggered the
// event (a signup, a vouch, a mint). This is a genuine optional side-effect at
// a system boundary, not an internal invariant — so failures are logged and
// swallowed rather than thrown. The trigger succeeds; only the announcement is
// best-effort. (Contrast the "assert, don't fall back" rule, which governs
// internal invariants — this is the legitimate external-boundary exception.)
//
// We AWAIT the POST (with a short timeout) rather than fire-and-forget, because
// on Vercel's serverless runtime an un-awaited promise can be frozen the instant
// the response is sent and never actually deliver.

type DiscordEmbed = {
	title: string;
	description?: string;
	url?: string;
	color?: number;
};

const ORIGIN = (env.ORIGIN || 'http://localhost:5173').replace(/\/$/, '');

async function postEmbed(embed: DiscordEmbed): Promise<void> {
	const url = env.DISCORD_WEBHOOK_URL;
	if (!url) return;
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: '6dtrust',
				embeds: [embed]
			}),
			signal: AbortSignal.timeout(4000)
		});
		if (!res.ok) {
			const body = await res.text().catch(() => '');
			console.error(`Discord webhook returned ${res.status}: ${body}`);
		}
	} catch (e) {
		console.error('Discord webhook post failed:', e);
	}
}

// A fresh identity claimed the trust graph for the first time.
export function notifySignup(githubLogin: string): Promise<void> {
	return postEmbed({
		title: '🌱 New signup',
		description: `**@${githubLogin}** just joined the trust graph.`,
		url: `${ORIGIN}/u/${githubLogin}`,
		color: 0x22c55e
	});
}

// Someone vouched for someone else (new edge or a level change).
export function notifyVouch(params: {
	voucher: string;
	subject: string;
	levelName: string;
}): Promise<void> {
	return postEmbed({
		title: '🤝 New vouch',
		description: `**@${params.voucher}** vouched for **@${params.subject}** — ${params.levelName}.`,
		url: `${ORIGIN}/u/${params.subject}`,
		color: 0x3b82f6
	});
}

// An unhandled server error (a real 500) surfaced by hooks.server.ts. Mirrors it
// to the same ops channel so a prod failure is seen the instant it happens
// instead of being dug out of Vercel logs — this is the channel that would have
// caught the KEY_ENCRYPTION_KEY-not-set 500 immediately. Best-effort like the rest.
export function notifyError(params: {
	method: string;
	path: string;
	message: string;
	stack?: string;
}): Promise<void> {
	const head = `**${params.method} ${params.path}**\n${params.message}`;
	let description = head;
	if (params.stack) {
		// Discord caps an embed description at 4096 chars — trim the stack to fit
		// inside a code fence (this is the platform's hard limit, not us hiding data).
		const budget = 4096 - head.length - 10; // room for the ``` … ``` fences + newlines
		if (budget > 0) {
			const stack =
				params.stack.length > budget ? params.stack.slice(0, budget - 1) + '…' : params.stack;
			description = `${head}\n\`\`\`\n${stack}\n\`\`\``;
		}
	}
	return postEmbed({ title: '🔴 Server error', description, color: 0xef4444 });
}

// An admin minted a new root.
export function notifyRootMint(params: { slug: string; name: string }): Promise<void> {
	return postEmbed({
		title: '🌳 New root minted',
		description: `**${params.name}** (\`${params.slug}\`) is now a trust root.`,
		url: `${ORIGIN}/r/${params.slug}`,
		color: 0xf59e0b
	});
}
