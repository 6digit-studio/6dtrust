import type { RequestHandler } from './$types';
import { BADGE_HEADERS, renderCompactBadge } from '$lib/server/trust/badge';
import { getBadgeReadout } from '$lib/server/trust/badge-readout';

/** Compact badge — 22px, for README badge rows beside CI shields. */
export const GET: RequestHandler = async ({ params }) => {
	const readout = await getBadgeReadout(params.root, params.handle);
	if (!readout) return new Response('root not found', { status: 404 });

	return new Response(renderCompactBadge(readout), { headers: BADGE_HEADERS });
};
