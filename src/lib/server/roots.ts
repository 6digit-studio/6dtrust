import type postgres from 'postgres';
import { sql } from './db';
import {
	GITHUB_USERNAME_RE,
	normalizeGithub,
	prefetchUnknownGithub,
	resolveGithubIdentity
} from './resolve';
import { recomputeRoot } from './trust/worker';
import { httpUrlOrNull } from './web-url';

type Tx = postgres.TransactionSql<Record<string, never>>;

const SLUG_RE = /^[a-z0-9-]{1,40}$/;

// Owner-supplied URLs land in href/src on the public root page. Empty clears the
// field; a non-empty value must be http(s) — reject javascript:/data:/etc. loudly
// (S7) rather than silently dropping or, worse, storing an XSS vector.
function cleanUrlOrThrow(raw: string | null, label: string): string | null {
	if (!raw?.trim()) return null;
	const url = httpUrlOrNull(raw);
	if (!url) throw new Error(`${label} must be an http(s) URL`);
	return url;
}

export interface RootSummary {
	id: string;
	slug: string;
	name: string;
	visibility: string;
	featured: boolean;
	tagline: string | null;
	description: string | null;
	avatarUrl: string | null;
	homepageUrl: string | null;
	seedCount: number;
	acceptedCount: number;
	computedAt: string | null;
}

export interface RootSeed {
	identityId: string;
	github: string;
	status: string;
}

// All roots owned by an identity, with seed/accept counts for the dashboard.
export async function listRootsForOwner(ownerId: string): Promise<RootSummary[]> {
	return await sql<RootSummary[]>`
		select r.id, r.slug, r.name, r.visibility, r.featured,
		       r.tagline, r.description,
		       r.avatar_url as "avatarUrl", r.homepage_url as "homepageUrl",
		       (select count(*) from root_seeds s where s.root_id = r.id)::int as "seedCount",
		       (select count(*) from accept_sets a where a.root_id = r.id)::int as "acceptedCount",
		       (select max(finished_at) from compute_runs cr where cr.root_id = r.id) as "computedAt"
		from roots r
		where r.owner_id = ${ownerId}
		order by r.created_at`;
}

// The seed members of a root (ownership enforced by the caller via listRootsForOwner).
export async function listSeeds(rootId: string): Promise<RootSeed[]> {
	return await sql<RootSeed[]>`
		select s.identity_id as "identityId",
		       coalesce(h.value, '(unknown)') as github,
		       i.status
		from root_seeds s
		join identities i on i.id = s.identity_id
		left join handles h on h.identity_id = s.identity_id and h.kind = 'github'
		where s.root_id = ${rootId}
		order by github`;
}

export interface RootPoison {
	identityId: string;
	github: string;
	reason: string;
	status: string;
}

// The nodes a root EXCLUDES (cap-0 in this root's flow). Owner-curated, public,
// reasoned — context-relative no, never a global judgment.
export async function listPoison(rootId: string): Promise<RootPoison[]> {
	return await sql<RootPoison[]>`
		select p.identity_id as "identityId",
		       coalesce(h.value, '(unknown)') as github,
		       p.reason,
		       i.status
		from root_poison p
		join identities i on i.id = p.identity_id
		left join handles h on h.identity_id = p.identity_id and h.kind = 'github'
		where p.root_id = ${rootId}
		order by github`;
}

export interface PublicAcceptedMember {
	github: string;
	level: number;
	isSeed: boolean;
}

export interface PublicRoot {
	slug: string;
	name: string;
	avatarUrl: string | null;
	tagline: string | null;
	description: string | null;
	homepageUrl: string | null;
	seedCount: number;
	acceptedCount: number;
	computedAt: string | null;
	seeds: RootSeed[];
}

// Featured public roots for the landing demo — seeds + counts only. Trust for
// everyone else is a per-person lookup (badge, trust JSON), never a browsable roster.
export async function listPublicRootsWithAcceptSets(): Promise<PublicRoot[]> {
	const roots = await sql<
		{
			id: string;
			slug: string;
			name: string;
			avatarUrl: string | null;
			tagline: string | null;
			description: string | null;
			homepageUrl: string | null;
			seedCount: number;
		}[]
	>`
		select r.id, r.slug, r.name, r.avatar_url as "avatarUrl",
		       r.tagline, r.description, r.homepage_url as "homepageUrl",
		       (select count(*) from root_seeds s where s.root_id = r.id)::int as "seedCount"
		from roots r
		where r.visibility = 'public' and r.featured = true
		order by r.created_at`;

	const out: PublicRoot[] = [];
	for (const r of roots) {
		const [{ acceptedCount }] = await sql<{ acceptedCount: number }[]>`
			select count(*)::int as "acceptedCount" from accept_sets where root_id = ${r.id}`;
		const seeds = await listSeeds(r.id);
		const [meta] = await sql<{ computedAt: string | null }[]>`
			select max(finished_at) as "computedAt" from compute_runs where root_id = ${r.id}`;
		out.push({
			slug: r.slug,
			name: r.name,
			avatarUrl: r.avatarUrl,
			tagline: r.tagline,
			description: r.description,
			homepageUrl: r.homepageUrl,
			seedCount: r.seedCount,
			acceptedCount,
			computedAt: meta?.computedAt ?? null,
			seeds
		});
	}
	return out;
}

export interface RootLink {
	label: string;
	url: string;
}

export interface RootProfile {
	id: string;
	slug: string;
	name: string;
	featured: boolean;
	tagline: string | null;
	description: string | null;
	avatarUrl: string | null;
	homepageUrl: string | null;
	links: RootLink[];
	seedCount: number;
	acceptedCount: number;
	computedAt: string | null;
	seeds: RootSeed[];
	poison: RootPoison[];
	audit: RootAuditEntry[];
}

// One public governance-log entry: a seed add/remove, a poison add/remove, or an
// ownership transfer, with github handles resolved. `actor` is null for events
// recorded before the audit gained attribution (0010).
export interface RootAuditEntry {
	at: string;
	kind: 'seed' | 'owner' | 'poison';
	action: string; // 'added' | 'removed' | 'transferred'
	subject: string | null; // the seed/poisoned node, or the new owner
	from: string | null; // previous owner (transfers only)
	reason: string | null; // poison events only — the stated why
	actor: string | null; // who did it
}

/** Public root page — seeds, counts, badge embed. No accept-set roster. */
export async function getPublicRootProfile(slug: string): Promise<RootProfile | null> {
	const roots = await sql<
		{
			id: string;
			slug: string;
			name: string;
			featured: boolean;
			tagline: string | null;
			description: string | null;
			avatarUrl: string | null;
			homepageUrl: string | null;
			seedCount: number;
			acceptedCount: number;
		}[]
	>`
		select r.id, r.slug, r.name, r.featured,
		       r.tagline, r.description,
		       r.avatar_url as "avatarUrl", r.homepage_url as "homepageUrl",
		       (select count(*) from root_seeds s where s.root_id = r.id)::int as "seedCount",
		       (select count(*) from accept_sets a where a.root_id = r.id)::int as "acceptedCount"
		from roots r
		where r.slug = ${slug} and r.visibility = 'public'
		limit 1`;
	if (roots.length === 0) return null;
	const r = roots[0];

	const links = await sql<RootLink[]>`
		select label, url from root_links
		where root_id = ${r.id}
		order by sort_order, label`;
	const seeds = await listSeeds(r.id);
	const poison = await listPoison(r.id);
	const [meta] = await sql<{ computedAt: string | null }[]>`
		select max(finished_at) as "computedAt" from compute_runs where root_id = ${r.id}`;
	const audit = await getRootAuditLog(r.id);

	return {
		id: r.id,
		slug: r.slug,
		name: r.name,
		featured: r.featured,
		tagline: r.tagline,
		description: r.description,
		avatarUrl: r.avatarUrl,
		homepageUrl: r.homepageUrl,
		links,
		seedCount: r.seedCount,
		acceptedCount: r.acceptedCount,
		computedAt: meta?.computedAt ?? null,
		seeds,
		poison,
		audit
	};
}

// Public governance log: seed add/removes + ownership transfers, merged
// newest-first with github handles resolved. The platform shows its own work —
// no silent moderation. Actor is null for pre-0010 (unattributed) history.
export async function getRootAuditLog(rootId: string): Promise<RootAuditEntry[]> {
	const seedEvents = await sql<
		{ at: string; action: string; subject: string | null; actor: string | null }[]
	>`
		select e.at, e.action,
		       sh.value as subject,
		       ah.value as actor
		from root_seed_events e
		left join handles sh on sh.identity_id = e.identity_id and sh.kind = 'github'
		left join handles ah on ah.identity_id = e.actor_id and ah.kind = 'github'
		where e.root_id = ${rootId}`;
	const ownerEvents = await sql<
		{ at: string; from: string | null; subject: string | null; actor: string | null }[]
	>`
		select e.at,
		       oh.value as "from",
		       nh.value as subject,
		       ah.value as actor
		from root_owner_events e
		left join handles oh on oh.identity_id = e.old_owner_id and oh.kind = 'github'
		left join handles nh on nh.identity_id = e.new_owner_id and nh.kind = 'github'
		left join handles ah on ah.identity_id = e.actor_id and ah.kind = 'github'
		where e.root_id = ${rootId}`;
	const poisonEvents = await sql<
		{ at: string; action: string; reason: string; subject: string | null; actor: string | null }[]
	>`
		select e.at, e.action, e.reason,
		       sh.value as subject,
		       ah.value as actor
		from root_poison_events e
		left join handles sh on sh.identity_id = e.identity_id and sh.kind = 'github'
		left join handles ah on ah.identity_id = e.actor_id and ah.kind = 'github'
		where e.root_id = ${rootId}`;

	const entries: RootAuditEntry[] = [
		...seedEvents.map((e) => ({
			at: new Date(e.at).toISOString(),
			kind: 'seed' as const,
			action: e.action,
			subject: e.subject,
			from: null,
			reason: null,
			actor: e.actor
		})),
		...ownerEvents.map((e) => ({
			at: new Date(e.at).toISOString(),
			kind: 'owner' as const,
			action: 'transferred',
			subject: e.subject,
			from: e.from,
			reason: null,
			actor: e.actor
		})),
		...poisonEvents.map((e) => ({
			at: new Date(e.at).toISOString(),
			kind: 'poison' as const,
			action: e.action,
			subject: e.subject,
			from: null,
			reason: e.reason || null,
			actor: e.actor
		}))
	];
	entries.sort((a, b) => b.at.localeCompare(a.at));
	return entries;
}

export async function updateRootProfile(params: {
	actorId: string;
	rootId: string;
	name: string;
	tagline: string | null;
	description: string | null;
	avatarUrl: string | null;
	homepageUrl: string | null;
}): Promise<void> {
	const name = params.name.trim();
	if (!name) throw new Error('name required');
	const tagline = params.tagline?.trim() || null;
	const description = params.description?.trim() || null;
	const avatarUrl = cleanUrlOrThrow(params.avatarUrl, 'avatar URL');
	const homepageUrl = cleanUrlOrThrow(params.homepageUrl, 'homepage URL');

	await sql.begin(async (tx) => {
		await assertCanManageRoot(tx, params.actorId, params.rootId);
		await tx`
			update roots set
				name = ${name},
				tagline = ${tagline},
				description = ${description},
				avatar_url = ${avatarUrl},
				homepage_url = ${homepageUrl}
			where id = ${params.rootId}`;
	});
}

// Admin view: every root system-wide, with its owner's github handle and counts.
// Distinct from listRootsForOwner (scoped to one owner) — this is the /admin
// console's roster of what's been minted.
export interface AdminRootRow {
	id: string;
	slug: string;
	name: string;
	featured: boolean;
	ownerGithub: string;
	seedCount: number;
	acceptedCount: number;
	createdAt: string;
}

export async function listAllRoots(): Promise<AdminRootRow[]> {
	return await sql<AdminRootRow[]>`
		select r.id, r.slug, r.name, r.featured,
		       coalesce(h.value, '(unknown)') as "ownerGithub",
		       (select count(*) from root_seeds s where s.root_id = r.id)::int as "seedCount",
		       (select count(*) from accept_sets a where a.root_id = r.id)::int as "acceptedCount",
		       r.created_at as "createdAt"
		from roots r
		left join handles h on h.identity_id = r.owner_id and h.kind = 'github'
		order by r.created_at desc`;
}

export async function createRoot(params: {
	// null = an unclaimed COMMUNITY root: seeded but owner-less, claimed later by
	// the first seed to sign up (auto-claim) or by an admin transfer. A claimable
	// seat held in trust, not a masquerade as the institution it's named for.
	ownerId: string | null;
	slug: string;
	name: string;
	tagline?: string | null;
	description?: string | null;
}): Promise<{ id: string; slug: string; name: string }> {
	const slug = params.slug.trim().toLowerCase();
	if (!SLUG_RE.test(slug)) {
		throw new Error('slug must be 1–40 chars: lowercase letters, digits, hyphens');
	}
	const name = params.name.trim();
	if (!name) throw new Error('name required');
	const tagline = params.tagline?.trim() || null;
	const description = params.description?.trim() || null;

	const existing = await sql<{ id: string }[]>`select id from roots where slug = ${slug} limit 1`;
	if (existing.length > 0) throw new Error(`a root with slug "${slug}" already exists`);

	const [{ id }] = await sql<{ id: string }[]>`
		insert into roots (owner_id, slug, name, tagline, description)
		values (${params.ownerId}, ${slug}, ${name}, ${tagline}, ${description})
		returning id`;
	return { id, slug, name };
}

// Assert the caller owns the root; returns its slug. Loud failure on missing/foreign root.
// Can the actor manage this root? Owner, or any admin (the override kill-switch).
// Admin overrides are NOT silent — the actor is recorded in the audit on every
// seed/ownership change, so "something bad happened" interventions are on record.
async function assertCanManageRoot(tx: Tx, actorId: string, rootId: string): Promise<void> {
	const [root] = await tx<{ owner_id: string | null }[]>`
		select owner_id from roots where id = ${rootId}`;
	if (!root) throw new Error('root not found');
	if (root.owner_id === actorId) return;
	const [actor] = await tx<{ is_admin: boolean }[]>`
		select is_admin from identities where id = ${actorId}`;
	if (actor?.is_admin) return;
	throw new Error('not your root');
}

export async function addSeed(params: {
	actorId: string;
	rootId: string;
	githubUsername: string;
}): Promise<{ github: string }> {
	const username = normalizeGithub(params.githubUsername);
	if (!GITHUB_USERNAME_RE.test(username)) throw new Error('invalid GitHub username');

	// network call (GitHub existence check) outside the transaction
	const github = await prefetchUnknownGithub(username);

	return await sql.begin(async (tx: Tx) => {
		await assertCanManageRoot(tx, params.actorId, params.rootId);
		const identityId = await resolveGithubIdentity(tx, username, github);
		// A seed edit moves the flow's origin — the most regime-changing single
		// act in the system. It gets an event row (0004) whenever it actually
		// changes state (the on-conflict no-op stays silent on purpose), now with
		// the acting identity recorded (0010).
		const inserted = await tx<{ root_id: string }[]>`
			insert into root_seeds (root_id, identity_id)
			values (${params.rootId}, ${identityId})
			on conflict (root_id, identity_id) do nothing
			returning root_id`;
		if (inserted.length > 0) {
			await tx`insert into root_seed_events (root_id, identity_id, action, actor_id)
			         values (${params.rootId}, ${identityId}, 'added', ${params.actorId})`;
		}
		return { github: username };
	});
}

export async function removeSeed(params: {
	actorId: string;
	rootId: string;
	identityId: string;
}): Promise<void> {
	await sql.begin(async (tx: Tx) => {
		await assertCanManageRoot(tx, params.actorId, params.rootId);
		const removed = await tx<{ root_id: string }[]>`
			delete from root_seeds
			where root_id = ${params.rootId} and identity_id = ${params.identityId}
			returning root_id`;
		if (removed.length > 0) {
			await tx`insert into root_seed_events (root_id, identity_id, action, actor_id)
			         values (${params.rootId}, ${params.identityId}, 'removed', ${params.actorId})`;
		}
	});
}

// Poison a node for one root: force it to capacity 0 in THIS root's flow, so it
// drops out of the accept set AND stops conducting trust through itself. Strictly
// per-root — never aggregated across roots (SCENE's sixth "no"). The reason is
// public and captured on the event so the *why* survives an un-poison.
export async function addPoison(params: {
	actorId: string;
	rootId: string;
	githubUsername: string;
	reason: string;
}): Promise<{ github: string }> {
	const username = normalizeGithub(params.githubUsername);
	if (!GITHUB_USERNAME_RE.test(username)) throw new Error('invalid GitHub username');
	const reason = params.reason.trim();

	// network call (GitHub existence check) outside the transaction
	const github = await prefetchUnknownGithub(username);

	return await sql.begin(async (tx: Tx) => {
		await assertCanManageRoot(tx, params.actorId, params.rootId);
		const identityId = await resolveGithubIdentity(tx, username, github);
		const inserted = await tx<{ root_id: string }[]>`
			insert into root_poison (root_id, identity_id, reason)
			values (${params.rootId}, ${identityId}, ${reason})
			on conflict (root_id, identity_id) do update set reason = excluded.reason
			returning root_id`;
		if (inserted.length > 0) {
			await tx`insert into root_poison_events (root_id, identity_id, action, reason, actor_id)
			         values (${params.rootId}, ${identityId}, 'added', ${reason}, ${params.actorId})`;
		}
		return { github: username };
	});
}

export async function removePoison(params: {
	actorId: string;
	rootId: string;
	identityId: string;
}): Promise<void> {
	await sql.begin(async (tx: Tx) => {
		await assertCanManageRoot(tx, params.actorId, params.rootId);
		const removed = await tx<{ reason: string }[]>`
			delete from root_poison
			where root_id = ${params.rootId} and identity_id = ${params.identityId}
			returning reason`;
		if (removed.length > 0) {
			await tx`insert into root_poison_events (root_id, identity_id, action, reason, actor_id)
			         values (${params.rootId}, ${params.identityId}, 'removed', ${removed[0].reason}, ${params.actorId})`;
		}
	});
}

// Feature / unfeature a root on the public landing. Only public roots can be
// featured — featuring a private root would expose it, so we refuse loudly.
export async function setFeatured(params: {
	actorId: string;
	rootId: string;
	featured: boolean;
}): Promise<void> {
	await sql.begin(async (tx: Tx) => {
		await assertCanManageRoot(tx, params.actorId, params.rootId);
		if (params.featured) {
			const [r] = await tx<{ visibility: string }[]>`
				select visibility from roots where id = ${params.rootId}`;
			if (r.visibility !== 'public') throw new Error('only public roots can be featured');
		}
		await tx`update roots set featured = ${params.featured} where id = ${params.rootId}`;
	});
}

// Recompute one root's accept_sets. At scale this is the batch worker's job
// (trust is stale-tolerant); on the current graph it's fast enough to run inline
// from the request so the differentiator is visible immediately after a seed edit.
export async function recomputeOwnedRoot(actorId: string, rootId: string) {
	await sql.begin(async (tx: Tx) => assertCanManageRoot(tx, actorId, rootId));
	return await recomputeRoot(sql, rootId);
}

// Admin-only ownership transfer — the community-takeover grant AND the admin
// reclaim. Resolves a github handle to an identity (creating a pinned unclaimed
// one if needed, so a root can be RESERVED for someone before they sign in), sets
// owner_id, and audits old -> new owner in root_owner_events.
export async function transferRoot(params: {
	actorId: string;
	rootId: string;
	newOwnerGithub: string;
}): Promise<{ newOwnerGithub: string }> {
	const username = normalizeGithub(params.newOwnerGithub);
	if (!GITHUB_USERNAME_RE.test(username)) throw new Error('invalid GitHub username');
	const github = await prefetchUnknownGithub(username);

	return await sql.begin(async (tx: Tx) => {
		const [actor] = await tx<{ is_admin: boolean }[]>`
			select is_admin from identities where id = ${params.actorId}`;
		if (!actor?.is_admin) throw new Error('admin only');

		const [root] = await tx<{ owner_id: string | null }[]>`
			select owner_id from roots where id = ${params.rootId}`;
		if (!root) throw new Error('root not found');

		const newOwnerId = await resolveGithubIdentity(tx, username, github);
		await tx`update roots set owner_id = ${newOwnerId} where id = ${params.rootId}`;
		await tx`insert into root_owner_events (root_id, old_owner_id, new_owner_id, actor_id)
		         values (${params.rootId}, ${root.owner_id}, ${newOwnerId}, ${params.actorId})`;
		return { newOwnerGithub: username };
	});
}
