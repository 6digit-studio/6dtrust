import { sql } from '../db';
import { normalizeHandle } from '../handle-kinds';
import { buildReadout, type TrustReadout } from './readout-shape';

// Per-person trust readout for a PUBLIC root. Returns null when the slug is not a
// public root (the route maps that to 404). A handle resolving to no identity —
// or to one not in the accept-set — is a valid PENDING readout, never an error.
// `kind` selects the anchor namespace (github by default; 'beji' for agents) —
// the one spot the read path used to hardcode GitHub.
export async function getTrustReadout(
	rootSlug: string,
	handleInput: string,
	origin: string,
	kind: string = 'github'
): Promise<TrustReadout | null> {
	const [root] = await sql<{ id: string }[]>`
		select id from roots where slug = ${rootSlug} and visibility = 'public' limit 1`;
	if (!root) return null;

	const handle = normalizeHandle(kind, handleInput);

	// One query: resolve the handle's identity (if any), its accept-set row for
	// this root (left join — absent = pending), and whether it's a seed.
	const [row] = await sql<
		{
			status: 'claimed' | 'unclaimed';
			level: number | null;
			distance: number | null;
			computedAt: string | null;
			isSeed: boolean;
		}[]
	>`
		select i.status,
		       a.level,
		       a.distance,
		       a.computed_at as "computedAt",
		       exists (
		         select 1 from root_seeds s where s.root_id = ${root.id} and s.identity_id = i.id
		       ) as "isSeed"
		from handles h
		join identities i on i.id = h.identity_id
		left join accept_sets a on a.root_id = ${root.id} and a.identity_id = i.id
		where h.kind = ${kind} and h.value = ${handle}
		limit 1`;

	return buildReadout(rootSlug, handle, origin, row ?? null);
}
