import { sql } from '../db';
import { GITHUB_USERNAME_RE, normalizeGithub } from '../resolve';
import type { BadgeReadout } from './badge';

export async function getBadgeReadout(rootSlug: string, handle: string): Promise<BadgeReadout | null> {
	const github = normalizeGithub(handle.replace(/\.svg$/, ''));
	// Match the trust route's validation so malformed handles are rejected before
	// they reach the DB (S12) — the route maps null to 404.
	if (!GITHUB_USERNAME_RE.test(github)) return null;

	const [root] = await sql<{ avatarUrl: string | null }[]>`
		select r.avatar_url as "avatarUrl"
		from roots r
		where r.slug = ${rootSlug} and r.visibility = 'public'
		limit 1`;
	if (!root) return null;

	const rows = await sql<{ level: number }[]>`
		select a.level
		from accept_sets a
		join roots r on r.id = a.root_id
		join handles h on h.identity_id = a.identity_id and h.kind = 'github'
		where r.slug = ${rootSlug} and h.value = ${github}
		limit 1`;

	const level = rows.length > 0 ? rows[0].level : 0;
	let avatarUrl = root.avatarUrl;
	if (avatarUrl && !avatarUrl.startsWith('https://')) avatarUrl = null;

	return { rootSlug, level, avatarUrl };
}
