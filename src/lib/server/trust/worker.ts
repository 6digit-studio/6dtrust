import type postgres from 'postgres';
import { computeAccepted, DEFAULT_CAPACITY_SCHEDULE } from './maxflow';
import { verifyVouch } from '../vouch-signature';

// Decoupled from $env so it runs as a standalone process: callers pass their own
// postgres client (the SvelteKit side passes $lib/server/db's sql; the CLI worker
// makes its own from DATABASE_URL).
type DB = postgres.Sql<Record<string, never>>;

export interface RecomputeResult {
	rootId: string;
	nodeCount: number;
	edgeCount: number;
	acceptedCount: number;
	reachableCount: number;
	eventCount: number;
	rejectedVouchCount: number;
	durationMs: number;
}

// Recompute one root: load the graph, run the 3-level Advogato metric, and
// replace its accept_sets. A node's level is the HIGHEST level at which it is
// accepted (trusted=3, vouched=2, known=1), matching Advogato's design of
// one run per level over the edge-subset at-or-above that level.
export async function recomputeRoot(
	sql: DB,
	rootId: string,
	schedule: number[] = DEFAULT_CAPACITY_SCHEDULE
): Promise<RecomputeResult> {
	// identities -> dense integer indices
	const identities = await sql<{ id: string }[]>`select id from identities order by id`;
	const n = identities.length;
	const idToIdx = new Map<string, number>();
	for (let i = 0; i < n; i++) idToIdx.set(identities[i].id, i);

	// Load active edges WITH the voucher's public key and the stored signature, and
	// verify each signature before it's allowed into the graph. The ed25519 sig is
	// the only thing standing between a forged/tampered `vouches` row (DB-write
	// attacker, bad import) and the public trust output — so an edge that doesn't
	// verify is NOT honored. We drop-and-count rather than hard-fail the whole
	// recompute: a single forged row must not become a denial-of-service lever over
	// every root's compute. A nonzero reject count is surfaced loudly (it means
	// tampering or an unsigned legacy row), never swallowed.
	const rawVouches = await sql<
		{
			voucher_id: string;
			subject_id: string;
			level: number;
			signature: Buffer | null;
			public_key: Buffer | null;
		}[]
	>`
		select v.voucher_id, v.subject_id, v.level, v.signature, vi.public_key
		from vouches v
		join identities vi on vi.id = v.voucher_id
		where v.revoked_at is null`;

	let rejectedVouchCount = 0;
	const vouches = rawVouches.filter((v) => {
		const ok = verifyVouch(v.public_key, v.voucher_id, v.subject_id, v.level, v.signature);
		if (!ok) rejectedVouchCount++;
		return ok;
	});
	if (rejectedVouchCount > 0) {
		console.error(
			`[recompute] root ${rootId}: rejected ${rejectedVouchCount} vouch row(s) with invalid/missing signatures — possible tampering or unsigned rows; excluded from the graph`
		);
	}

	const seedRows = await sql<{ identity_id: string }[]>`
		select identity_id from root_seeds where root_id = ${rootId}`;
	const seeds: number[] = [];
	for (const r of seedRows) {
		const idx = idToIdx.get(r.identity_id);
		if (idx !== undefined) seeds.push(idx);
	}
	if (seeds.length === 0) throw new Error(`root ${rootId} has no resolvable seeds`);

	// Per-root poison: nodes this root excludes. Loaded exactly like seeds and
	// forced to capacity 0 in every level run, so a poisoned node drops out AND
	// stops conducting trust through itself. Strictly per-root — never aggregated.
	const poisonRows = await sql<{ identity_id: string }[]>`
		select identity_id from root_poison where root_id = ${rootId}`;
	const poison: number[] = [];
	for (const r of poisonRows) {
		const idx = idToIdx.get(r.identity_id);
		if (idx !== undefined) poison.push(idx);
	}

	const t0 = performance.now();
	const acceptedLevel = new Int32Array(n);
	let fullEdgeCount = 0;
	let reachableCount = 0;
	// Hop-distance from nearest seed over the FULL vouch graph — captured from the
	// L=1 pass, whose edge set is every active vouch. A node accepted at any level
	// is reachable in this graph, so its distance here is finite (>= 0).
	let distance: Int32Array | null = null;
	for (const L of [3, 2, 1]) {
		const ef: number[] = [];
		const et: number[] = [];
		for (const v of vouches) {
			if (v.level < L) continue;
			const a = idToIdx.get(v.voucher_id);
			const b = idToIdx.get(v.subject_id);
			if (a !== undefined && b !== undefined) {
				ef.push(a);
				et.push(b);
			}
		}
		const result = computeAccepted({ nodeCount: n, edgeFrom: ef, edgeTo: et, seeds, poison }, schedule);
		if (L === 1) {
			fullEdgeCount = ef.length;
			// Reachable mass over the full edge set: reachable - accepted is
			// the attack-pressure reading (what a sybil fan-out looks like).
			reachableCount = result.reachableCount;
			distance = result.distance;
		}
		for (let i = 0; i < n; i++)
			if (result.accepted[i] && acceptedLevel[i] === 0) acceptedLevel[i] = L;
	}
	const durationMs = Math.round(performance.now() - t0);

	// L=1 always runs, so distance is set; assert rather than silently writing nulls.
	if (distance === null) throw new Error('distance unset — the L=1 pass did not run');
	const rows: { root_id: string; identity_id: string; level: number; distance: number }[] = [];
	for (let i = 0; i < n; i++) {
		if (acceptedLevel[i] > 0) {
			rows.push({
				root_id: rootId,
				identity_id: identities[i].id,
				level: acceptedLevel[i],
				distance: distance[i]
			});
		}
	}

	// newRow: the freshly-computed worldview (pure, no DB) — level + seed distance.
	const newRow = new Map(rows.map((r) => [r.identity_id, { level: r.level, distance: r.distance }]));

	// Apply the recompute as a DIFF, not a full replace. Read the current
	// accept-set INSIDE the transaction (so the diff is against the exact state we
	// mutate), compute membership churn (entered/exited/level changes), and write
	// ONLY what moved — a no-op recompute writes zero accept_set rows, so Neon
	// write volume tracks change, not accept-set size. That churn is also the
	// faucet event stream.
	let eventCount = 0;
	await sql.begin(async (tx) => {
		const oldRows = await tx<{ identity_id: string; level: number; distance: number | null }[]>`
			select identity_id, level, distance from accept_sets where root_id = ${rootId}`;
		const oldRow = new Map(oldRows.map((r) => [r.identity_id, { level: r.level, distance: r.distance }]));

		const events: {
			root_id: string;
			identity_id: string;
			event: string;
			old_level: number | null;
			new_level: number | null;
		}[] = [];
		const inserts: { root_id: string; identity_id: string; level: number; distance: number }[] = [];
		const updates: { identity_id: string; level: number; distance: number }[] = [];
		const deletes: string[] = [];
		for (const [id, nr] of newRow) {
			const prev = oldRow.get(id);
			if (prev === undefined) {
				events.push({ root_id: rootId, identity_id: id, event: 'entered', old_level: null, new_level: nr.level });
				inserts.push({ root_id: rootId, identity_id: id, level: nr.level, distance: nr.distance });
			} else {
				// Level change is a faucet event; a distance-only change still needs a
				// write to keep the materialized readout correct (and to backfill the
				// nullable column on the first recompute after the migration).
				if (prev.level !== nr.level) {
					events.push({
						root_id: rootId,
						identity_id: id,
						event: nr.level > prev.level ? 'level_up' : 'level_down',
						old_level: prev.level,
						new_level: nr.level
					});
				}
				if (prev.level !== nr.level || prev.distance !== nr.distance) {
					updates.push({ identity_id: id, level: nr.level, distance: nr.distance });
				}
			}
		}
		for (const [id, pr] of oldRow) {
			if (!newRow.has(id)) {
				events.push({ root_id: rootId, identity_id: id, event: 'exited', old_level: pr.level, new_level: null });
				deletes.push(id);
			}
		}

		// Write only the delta.
		if (inserts.length > 0) {
			await tx`insert into accept_sets ${tx(inserts, 'root_id', 'identity_id', 'level', 'distance')}`;
		}
		for (const u of updates) {
			await tx`update accept_sets set level = ${u.level}, distance = ${u.distance}
			         where root_id = ${rootId} and identity_id = ${u.identity_id}`;
		}
		if (deletes.length > 0) {
			await tx`delete from accept_sets where root_id = ${rootId} and identity_id in ${tx(deletes)}`;
		}
		const [run] = await tx<{ id: string }[]>`insert into compute_runs
		         (root_id, finished_at, node_count, edge_count, accepted_count, reachable_count, duration_ms)
		         values (${rootId}, now(), ${n}, ${fullEdgeCount}, ${rows.length}, ${reachableCount}, ${durationMs})
		         returning id`;
		if (events.length > 0) {
			const withRun = events.map((e) => ({ ...e, compute_run_id: run.id }));
			await tx`insert into accept_set_events ${tx(
				withRun,
				'compute_run_id',
				'root_id',
				'identity_id',
				'event',
				'old_level',
				'new_level'
			)}`;
		}
		eventCount = events.length;
	});

	return {
		rootId,
		nodeCount: n,
		edgeCount: fullEdgeCount,
		acceptedCount: rows.length,
		reachableCount,
		eventCount,
		rejectedVouchCount,
		durationMs
	};
}
