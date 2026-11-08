import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { normalizeHandle, isValidHandle } from '$lib/server/handle-kinds';
import { getTrustReadout } from '$lib/server/trust/readout';
import { READ_CACHE_CONTROL } from '$lib/server/cache';

// GET /trust/{root}/{handle}[?kind=github|beji] — machine-readable trust readout
// for a public root. `kind` selects the identity namespace (default github; use
// `beji` for agent identities). Always 200 for a valid handle (pending is a
// state, not an error); 404 on an unknown or private root; 400 on a malformed
// handle or unknown kind. Materialized read → carries a CDN cache header.
export const GET: RequestHandler = async ({ params, url }) => {
	const kind = url.searchParams.get('kind') ?? 'github';
	const handle = normalizeHandle(kind, params.handle.replace(/\.json$/, ''));
	if (!isValidHandle(kind, handle)) throw error(400, 'malformed handle or unknown kind');

	const origin = (env.ORIGIN || url.origin).replace(/\/$/, '');
	const readout = await getTrustReadout(params.root, handle, origin, kind);
	if (!readout) throw error(404, 'unknown root');

	// Raw Response, mirroring the badge route: the SvelteKit json() helper's
	// response was not getting CDN-cached on Vercel even with identical headers.
	return new Response(JSON.stringify(readout), {
		headers: { 'content-type': 'application/json', 'cache-control': READ_CACHE_CONTROL }
	});
};
