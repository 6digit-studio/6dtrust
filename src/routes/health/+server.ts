import { json } from '@sveltejs/kit';
import { sql } from '$lib/server/db';

// Liveness probe: proves the SvelteKit <-> Postgres connection. Deliberately does
// NOT enumerate table names — that was unauthenticated schema recon (S10). A
// single round-trip is enough to prove the DB is reachable.
export async function GET() {
	const [{ now }] = await sql<{ now: string }[]>`select now()`;
	return json({ ok: true, now });
}
