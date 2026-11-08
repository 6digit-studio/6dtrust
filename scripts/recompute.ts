// Standalone compute worker: recompute accept_sets for every root.
// Usage: DATABASE_URL=... bun scripts/recompute.ts
import postgres from 'postgres';
import { recomputeRoot } from '../src/lib/server/trust/worker';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL not set');
	process.exit(1);
}
const sql = postgres(url);

const roots = await sql<{ id: string; slug: string }[]>`
	select id, slug from roots order by created_at`;
if (roots.length === 0) {
	console.log('no roots to compute');
	await sql.end();
	process.exit(0);
}

for (const r of roots) {
	try {
		const res = await recomputeRoot(sql, r.id);
		console.log(
			`root "${r.slug}": nodes=${res.nodeCount} edges=${res.edgeCount} ` +
				`accepted=${res.acceptedCount} in ${res.durationMs}ms`
		);
	} catch (e) {
		console.error(`root "${r.slug}" failed:`, e instanceof Error ? e.message : e);
	}
}
await sql.end();
