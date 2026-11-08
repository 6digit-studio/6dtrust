// Ceiling pressure (v0 approximation): per root, latest accepted_count over
// the seed budget (seeds x schedule[0]=800). Max across roots = the most
// saturated worldview. Attack pressure: reachable - accepted on the same run.
import postgres from 'postgres';
const url = process.env.DATABASE_URL;
if (!url) { console.error('probe_ceiling: DATABASE_URL not set'); process.exit(1); }
const sql = postgres(url, { max: 1 });
const rows = await sql<{ accepted: number; reachable: number | null; seeds: string }[]>`
	select distinct on (cr.root_id)
	       cr.accepted_count as accepted, cr.reachable_count as reachable,
	       (select count(*) from root_seeds rs where rs.root_id = cr.root_id) as seeds
	from compute_runs cr where cr.root_id is not null
	order by cr.root_id, cr.started_at desc`;
let pressure = 0, attack = 0;
for (const r of rows) {
	const budget = Number(r.seeds) * 800;
	if (budget > 0) pressure = Math.max(pressure, r.accepted / budget);
	if (r.reachable != null) attack = Math.max(attack, r.reachable - r.accepted);
}
console.log(`signal ceiling_pressure ${pressure.toFixed(4)} ratio`);
console.log(`signal attack_pressure ${attack}`);
await sql.end();
