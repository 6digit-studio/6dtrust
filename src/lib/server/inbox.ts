import { sql } from './db';
import { GITHUB_USERNAME_RE, normalizeGithub } from './resolve';
import { upgradeVouch } from './vouch';
import { isBotHandle } from './inbox-rules';

export interface InboxSuggestion {
	id: string;
	subjectGithub: string;
	source: string;
	context: Record<string, unknown>;
	lastSeenAt: string;
	createdAt: string;
}

// Internal ingest (the GitHub merge handler will call this). One OPEN row per
// (voucher, subject, source): a repeat refreshes context + last_seen_at instead
// of stacking. Skips bots and malformed handles; requires a real voucher identity.
export async function ingestSuggestion(params: {
	voucherId: string;
	subjectGithub: string;
	source: string;
	context: Record<string, unknown>;
}): Promise<{ ingested: boolean }> {
	const subject = normalizeGithub(params.subjectGithub);
	if (!GITHUB_USERNAME_RE.test(subject) || isBotHandle(subject)) return { ingested: false };

	const [voucher] = await sql<{ ok: number }[]>`
		select 1 as ok from identities where id = ${params.voucherId}`;
	if (!voucher) return { ingested: false };

	await sql`
		insert into inbox_suggestions (voucher_id, subject_github, source, context)
		values (${params.voucherId}, ${subject}, ${params.source}, ${JSON.stringify(params.context)}::jsonb)
		on conflict (voucher_id, subject_github, source)
		    where dismissed_at is null and acted_at is null
		do update set context = excluded.context, last_seen_at = now()`;
	return { ingested: true };
}

// A maintainer's open queue — newest activity first.
export async function listInbox(voucherId: string): Promise<InboxSuggestion[]> {
	return await sql<InboxSuggestion[]>`
		select id::text, subject_github as "subjectGithub", source, context,
		       last_seen_at as "lastSeenAt", created_at as "createdAt"
		from inbox_suggestions
		where voucher_id = ${voucherId} and dismissed_at is null and acted_at is null
		order by last_seen_at desc`;
}

// Act on one of YOUR suggestions: dismiss, or vouch at a level (upgrade-only, so
// re-acting never downgrades a stronger vouch you already made). Ownership is
// enforced — you can only act on a suggestion addressed to you.
export async function actOnSuggestion(params: {
	voucherId: string;
	suggestionId: string;
	action: 'dismiss' | 'known' | 'vouch' | 'trust';
}): Promise<{ done: string }> {
	const [s] = await sql<{ subject_github: string }[]>`
		select subject_github from inbox_suggestions
		where id = ${params.suggestionId} and voucher_id = ${params.voucherId}
		  and dismissed_at is null and acted_at is null`;
	if (!s) throw new Error('suggestion not found');

	if (params.action === 'dismiss') {
		await sql`update inbox_suggestions set dismissed_at = now() where id = ${params.suggestionId}`;
		return { done: 'dismissed' };
	}

	const level = params.action === 'known' ? 1 : params.action === 'vouch' ? 2 : 3;
	await upgradeVouch({ voucherId: params.voucherId, githubUsername: s.subject_github, level });
	await sql`update inbox_suggestions
	          set acted_at = now(), acted_level = ${level}
	          where id = ${params.suggestionId}`;
	return { done: `vouched at level ${level}` };
}
