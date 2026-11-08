import { sql } from './db';
import { GITHUB_USERNAME_RE, normalizeGithub } from './resolve';

export interface PersonRootLevel {
	slug: string;
	name: string;
	level: number;
	isSeed: boolean;
	computedAt: string | null;
}

export interface PersonVouch {
	github: string;
	level: number;
}

export interface PersonProfile {
	github: string;
	identityId: string;
	status: string;
	rootLevels: PersonRootLevel[];
	incoming: PersonVouch[];
	outgoing: PersonVouch[];
}

/** Public profile for a GitHub anchor handle — trust readouts, vouch graph edges. */
export async function getPersonProfile(handle: string): Promise<PersonProfile | null> {
	const github = normalizeGithub(handle);
	if (!GITHUB_USERNAME_RE.test(github)) return null;

	const identities = await sql<{ id: string; status: string }[]>`
		select i.id, i.status
		from handles h
		join identities i on i.id = h.identity_id
		where h.kind = 'github' and h.value = ${github}
		limit 1`;
	if (identities.length === 0) return null;
	const { id: identityId, status } = identities[0];

	const rootLevels = await sql<PersonRootLevel[]>`
		select r.slug, r.name, a.level,
		       exists (
		         select 1 from root_seeds s
		         where s.root_id = a.root_id and s.identity_id = a.identity_id
		       ) as "isSeed",
		       a.computed_at as "computedAt"
		from accept_sets a
		join roots r on r.id = a.root_id
		where a.identity_id = ${identityId} and r.visibility = 'public'
		order by a.level desc, r.slug asc`;

	const incoming = await sql<PersonVouch[]>`
		select coalesce(h.value, '(unknown)') as github, v.level
		from vouches v
		left join handles h on h.identity_id = v.voucher_id and h.kind = 'github'
		where v.subject_id = ${identityId} and v.revoked_at is null
		order by v.level desc, github asc`;

	const outgoing = await sql<PersonVouch[]>`
		select coalesce(h.value, '(unknown)') as github, v.level
		from vouches v
		left join handles h on h.identity_id = v.subject_id and h.kind = 'github'
		where v.voucher_id = ${identityId} and v.revoked_at is null
		order by v.level desc, github asc`;

	return { github, identityId, status, rootLevels, incoming, outgoing };
}
