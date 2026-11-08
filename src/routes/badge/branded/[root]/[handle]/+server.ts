import type { RequestHandler } from './$types';
import { BADGE_HEADERS, fetchLogoDataUri, renderBrandedBadge } from '$lib/server/trust/badge';
import { getBadgeReadout } from '$lib/server/trust/badge-readout';

/** Branded badge — root emblem + stacked readout, separate URL from the compact chip. */
export const GET: RequestHandler = async ({ params }) => {
	const readout = await getBadgeReadout(params.root, params.handle);
	if (!readout) return new Response('root not found', { status: 404 });

	const avatarDataUri = readout.avatarUrl ? await fetchLogoDataUri(readout.avatarUrl) : null;

	return new Response(renderBrandedBadge({ ...readout, avatarDataUri }), { headers: BADGE_HEADERS });
};
