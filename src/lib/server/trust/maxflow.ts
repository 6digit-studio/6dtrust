// Advogato-style attack-resistant trust metric via max-flow with node capacities.
//
// Construction (documented here; the exact Advogato capacity schedule is a
// placeholder pending recovery from mod_virgule, but the wiring follows the
// thesis: node capacities, node-splitting, unit edges to a supersink, and the
// accepted set read off the saturated unit edges):
//
//   capacity(v) = schedule[ distance(v from nearest seed) ], and 0 if v is
//   unreachable or beyond the schedule. The decreasing schedule yields both
//   attack-resistance AND a natural locality horizon (capacity-0 nodes drop out).
//
//   node-splitting — each node v becomes v_in (2v) and v_out (2v+1):
//     source -> seed.v_in              capacity INF
//     v_in   -> sink                   capacity 1            ("accept" unit)
//     v_in   -> v_out                  capacity cap(v) - 1   (onward budget)
//     u_out  -> w_in   for vouch u->w  capacity INF          (certs unbounded;
//                                                             only nodes are capped)
//
//   max-flow source->sink; v is ACCEPTED iff its v_in->sink unit edge is saturated.
//
// Property: the number of bogus nodes that can be accepted is bounded by the
// capacity of the cut of good->bad cert edges, independent of how many bogus
// nodes exist. (Pinned by maxflow.test.ts.)

const INF = 1 << 30;

// Placeholder decreasing schedule (capacity by distance from seed). Index = hop
// count; nodes beyond the last index get capacity 0 (the horizon).
export const DEFAULT_CAPACITY_SCHEDULE = [800, 200, 50, 12, 4, 2, 1];

export interface TrustGraphInput {
	nodeCount: number;
	edgeFrom: Int32Array | number[]; // vouch edges: voucher -> subject
	edgeTo: Int32Array | number[];
	seeds: number[];
	// Per-root poison: node indices this root EXCLUDES. A poisoned node is forced
	// to capacity 0, so it both drops out of the accept set AND stops conducting
	// trust through itself (see the cap-0 handling below). Context-relative no:
	// this is THIS root being opinionated, never a global judgment.
	poison?: Iterable<number>;
}

export interface TrustResult {
	accepted: Uint8Array; // 1 if node is in the trusted set
	acceptedCount: number;
	// Nodes within the capacity horizon of a seed (cap > 0) — the candidate
	// mass. reachable - accepted is the attack-pressure reading: what a sybil
	// fan-out looks like from inside the metric.
	reachableCount: number;
	// Hop distance from the nearest seed over vouch edges: 0 = seed, -1 =
	// unreachable. Computed by the BFS below anyway; surfaced so the worker can
	// materialize it for the trust readout instead of recomputing it.
	distance: Int32Array;
}

export function computeAccepted(
	g: TrustGraphInput,
	schedule: number[] = DEFAULT_CAPACITY_SCHEDULE
): TrustResult {
	const n = g.nodeCount;
	const m = g.edgeFrom.length;

	// --- 1. BFS distance from seeds over vouch edges (forward CSR adjacency) ---
	const outDeg = new Int32Array(n);
	for (let i = 0; i < m; i++) outDeg[g.edgeFrom[i]]++;
	const outStart = new Int32Array(n + 1);
	for (let v = 0; v < n; v++) outStart[v + 1] = outStart[v] + outDeg[v];
	const outAdj = new Int32Array(m);
	const cursor = outStart.slice(0, n);
	for (let i = 0; i < m; i++) {
		const u = g.edgeFrom[i];
		outAdj[cursor[u]++] = g.edgeTo[i];
	}

	const dist = new Int32Array(n).fill(-1);
	const bq = new Int32Array(n);
	let qh = 0;
	let qt = 0;
	for (const s of g.seeds) {
		if (dist[s] === -1) {
			dist[s] = 0;
			bq[qt++] = s;
		}
	}
	while (qh < qt) {
		const u = bq[qh++];
		for (let e = outStart[u]; e < outStart[u + 1]; e++) {
			const w = outAdj[e];
			if (dist[w] === -1) {
				dist[w] = dist[u] + 1;
				bq[qt++] = w;
			}
		}
	}

	const last = schedule.length - 1;
	const cap = new Int32Array(n);
	let reachableCount = 0;
	for (let v = 0; v < n; v++) {
		if (dist[v] === -1 || dist[v] > last) cap[v] = 0;
		else {
			cap[v] = schedule[dist[v]];
			reachableCount++;
		}
	}

	// Poison: force excluded nodes to capacity 0 — identical to falling off the
	// horizon. A cap-0 node gets no accept-unit edge and no cert edges below, so it
	// neither joins the accept set nor conducts trust onward. We also drop it from
	// reachableCount: it is an intentional exclusion, not sybil attack-pressure.
	if (g.poison) {
		for (const p of g.poison) {
			if (p >= 0 && p < n && cap[p] > 0) {
				cap[p] = 0;
				reachableCount--;
			}
		}
	}

	// --- 2. build the flow network ---
	const S = 2 * n;
	const T = 2 * n + 1;
	const V = 2 * n + 2;
	const maxE = 2 * (g.seeds.length + 2 * n + m); // x2 for residual reverse edges
	const eto = new Int32Array(maxE);
	const ecap = new Int32Array(maxE);
	const enext = new Int32Array(maxE);
	const head = new Int32Array(V).fill(-1);
	let ec = 0;
	const addEdge = (u: number, v: number, c: number) => {
		eto[ec] = v;
		ecap[ec] = c;
		enext[ec] = head[u];
		head[u] = ec++;
		eto[ec] = u;
		ecap[ec] = 0;
		enext[ec] = head[v];
		head[v] = ec++;
	};

	const acceptEdge = new Int32Array(n).fill(-1); // index of each v_in->sink edge
	for (let v = 0; v < n; v++) {
		if (cap[v] <= 0) continue;
		acceptEdge[v] = ec; // forward edge index (even)
		addEdge(2 * v, T, 1); // v_in -> sink (accept unit)
		if (cap[v] - 1 > 0) addEdge(2 * v, 2 * v + 1, cap[v] - 1); // v_in -> v_out
	}
	for (const s of g.seeds) if (cap[s] > 0) addEdge(S, 2 * s, INF);
	for (let i = 0; i < m; i++) {
		const u = g.edgeFrom[i];
		const w = g.edgeTo[i];
		if (cap[u] > 0 && cap[w] > 0) addEdge(2 * u + 1, 2 * w, INF); // u_out -> w_in
	}

	// --- 3. Dinic max-flow ---
	const level = new Int32Array(V);
	const it = new Int32Array(V);
	const dq = new Int32Array(V);
	const bfs = (): boolean => {
		level.fill(-1);
		let h = 0;
		let t = 0;
		level[S] = 0;
		dq[t++] = S;
		while (h < t) {
			const u = dq[h++];
			for (let e = head[u]; e !== -1; e = enext[e]) {
				if (ecap[e] > 0 && level[eto[e]] === -1) {
					level[eto[e]] = level[u] + 1;
					dq[t++] = eto[e];
				}
			}
		}
		return level[T] !== -1;
	};
	const dfs = (u: number, f: number): number => {
		if (u === T) return f;
		for (; it[u] !== -1; it[u] = enext[it[u]]) {
			const e = it[u];
			const v = eto[e];
			if (ecap[e] > 0 && level[v] === level[u] + 1) {
				const d = dfs(v, Math.min(f, ecap[e]));
				if (d > 0) {
					ecap[e] -= d;
					ecap[e ^ 1] += d;
					return d;
				}
			}
		}
		return 0;
	};
	while (bfs()) {
		for (let i = 0; i < V; i++) it[i] = head[i];
		let f: number;
		do {
			f = dfs(S, INF);
		} while (f > 0);
	}

	// --- 4. accepted = nodes whose v_in->sink unit edge is saturated ---
	const accepted = new Uint8Array(n);
	let acceptedCount = 0;
	for (let v = 0; v < n; v++) {
		const ae = acceptEdge[v];
		if (ae !== -1 && ecap[ae] === 0) {
			accepted[v] = 1;
			acceptedCount++;
		}
	}
	return { accepted, acceptedCount, reachableCount, distance: dist };
}
