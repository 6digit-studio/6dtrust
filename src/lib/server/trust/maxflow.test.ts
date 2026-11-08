/// <reference types="bun" />
import { test, expect } from 'bun:test';
import { computeAccepted } from './maxflow';

const SCHEDULE = [800, 200, 50, 12, 4, 2, 1];

test('seed and a chain within the horizon are all accepted', () => {
	// 0(seed) -> 1 -> 2 -> 3, all within distance 3
	const g = { nodeCount: 4, edgeFrom: [0, 1, 2], edgeTo: [1, 2, 3], seeds: [0] };
	const { accepted, acceptedCount } = computeAccepted(g, SCHEDULE);
	expect([...accepted]).toEqual([1, 1, 1, 1]);
	expect(acceptedCount).toBe(4);
});

test('distance is hop count from nearest seed (0=seed, -1=unreachable)', () => {
	// 0(seed) -> 1 -> 2 ; node 3 disconnected
	const g = { nodeCount: 4, edgeFrom: [0, 1], edgeTo: [1, 2], seeds: [0] };
	const { distance } = computeAccepted(g, SCHEDULE);
	expect([...distance]).toEqual([0, 1, 2, -1]);
});

test('distance takes the nearest of multiple seeds', () => {
	// seeds 0 and 3; node 2 is 2 hops from 0 (0->1->2) but 1 hop from 3 (3->2)
	const g = { nodeCount: 4, edgeFrom: [0, 1, 3], edgeTo: [1, 2, 2], seeds: [0, 3] };
	const { distance } = computeAccepted(g, SCHEDULE);
	expect([...distance]).toEqual([0, 1, 1, 0]);
});

test('unreachable nodes are not accepted', () => {
	// 0(seed) -> 1 ; nodes 2,3 are disconnected
	const g = { nodeCount: 4, edgeFrom: [0], edgeTo: [1], seeds: [0] };
	const { accepted } = computeAccepted(g, SCHEDULE);
	expect(accepted[0]).toBe(1);
	expect(accepted[1]).toBe(1);
	expect(accepted[2]).toBe(0);
	expect(accepted[3]).toBe(0);
});

test('nodes beyond the schedule horizon drop out', () => {
	// a chain longer than the schedule (length 7 -> max distance index 6).
	// node at distance 7 has capacity 0 and cannot be accepted.
	const from: number[] = [];
	const to: number[] = [];
	for (let i = 0; i < 8; i++) {
		from.push(i);
		to.push(i + 1);
	}
	const g = { nodeCount: 9, edgeFrom: from, edgeTo: to, seeds: [0] };
	const { accepted } = computeAccepted(g, SCHEDULE);
	// distances 0..6 accepted (nodes 0..6), distance 7+ (nodes 7,8) rejected
	expect(accepted[6]).toBe(1);
	expect(accepted[7]).toBe(0);
	expect(accepted[8]).toBe(0);
});

test('PER-VIEWER SEEDS: the same node gets opposite verdicts under different seeds', () => {
	// The core differentiator over plain Advogato: trust is computed RELATIVE to
	// the viewer's seed set, not a single global root. Two communities, weakly
	// bridged one-way:
	//   A: hub 0 -> members 1, 2     (seed set "A" = {0})
	//   B: hub 4 -> members 5, 6     (seed set "B" = {4})
	//   bridge: 2 -> 4               (an A member vouches for B's hub)
	// From A you can reach B (via the bridge); from B you canNOT reach back into A.
	const g = {
		nodeCount: 7,
		edgeFrom: [0, 0, 2, 4, 4],
		edgeTo: [1, 2, 4, 5, 6],
		seeds: [] as number[]
	};

	const fromA = computeAccepted({ ...g, seeds: [0] }, SCHEDULE).accepted;
	const fromB = computeAccepted({ ...g, seeds: [4] }, SCHEDULE).accepted;

	// The headline: node 1 (an A member) is TRUSTED under root A, UNTRUSTED under root B.
	// Same node, same graph, opposite verdict — purely because the viewer differs.
	expect(fromA[1]).toBe(1);
	expect(fromB[1]).toBe(0);
	expect(fromA[2]).toBe(1);
	expect(fromB[2]).toBe(0);

	// Symmetric control: B's hub and members are reachable from A (via the bridge)
	// AND from B, so they're accepted under both — not everything diverges.
	expect(fromA[4]).toBe(1);
	expect(fromB[4]).toBe(1);
	expect(fromA[5]).toBe(1);
	expect(fromB[5]).toBe(1);

	// And each seed is, trivially, accepted under its own root.
	expect(fromA[0]).toBe(1);
	expect(fromB[4]).toBe(1);
});

test('POISON: an excluded node drops out AND stops conducting trust through itself', () => {
	// 0(seed) -> 1 -> 2 -> 3, a chain all within the horizon. Poison node 1.
	// Without poison, all four are accepted. With node 1 poisoned, node 1 drops
	// (cap 0), and because 2 and 3 are reachable ONLY through 1, they lose their
	// path too — the exclusion propagates exactly like 1 had never been vouched.
	const g = { nodeCount: 4, edgeFrom: [0, 1, 2], edgeTo: [1, 2, 3], seeds: [0] };

	const clean = computeAccepted(g, SCHEDULE).accepted;
	expect([...clean]).toEqual([1, 1, 1, 1]); // baseline: everyone trusted

	const { accepted } = computeAccepted({ ...g, poison: [1] }, SCHEDULE);
	expect(accepted[0]).toBe(1); // seed still trusted
	expect(accepted[1]).toBe(0); // poisoned node drops out
	expect(accepted[2]).toBe(0); // only reachable via 1 -> conduction is cut
	expect(accepted[3]).toBe(0); // and so is everything downstream of it
});

test('POISON: a node with an independent path survives the exclusion of one voucher', () => {
	// 0(seed) -> 1, 0 -> 2, and both 1 -> 3 and 2 -> 3. Node 3 has two paths in.
	// Poison node 1: node 3 still rides the 0 -> 2 -> 3 path. Poison is surgical —
	// it removes the node and its conduction, not everything that node ever touched.
	const g = { nodeCount: 4, edgeFrom: [0, 0, 1, 2], edgeTo: [1, 2, 3, 3], seeds: [0] };

	const { accepted } = computeAccepted({ ...g, poison: [1] }, SCHEDULE);
	expect(accepted[0]).toBe(1); // seed
	expect(accepted[1]).toBe(0); // poisoned
	expect(accepted[2]).toBe(1); // untouched, independent of node 1
	expect(accepted[3]).toBe(1); // survives via 0 -> 2 -> 3
});

test('POISON: reachableCount drops the excluded node (exclusion, not attack-pressure)', () => {
	// 0(seed) -> 1 -> 2. All reachable. Poisoning 2 removes it from the reachable
	// mass: an intentional exclusion must not read as sybil attack-pressure
	// (reachable - accepted), which would inflate the attack gauge with our own no.
	const g = { nodeCount: 3, edgeFrom: [0, 1], edgeTo: [1, 2], seeds: [0] };

	const clean = computeAccepted(g, SCHEDULE);
	expect(clean.reachableCount).toBe(3);

	const poisoned = computeAccepted({ ...g, poison: [2] }, SCHEDULE);
	expect(poisoned.reachableCount).toBe(2); // 2 is gone from the candidate mass
	expect(poisoned.accepted[2]).toBe(0);
});

test('ATTACK RESISTANCE: a huge bogus fan-out is bounded by the bottleneck node', () => {
	// 0(seed) -> 1(good). 1 -> 2(bad): the single good->bad edge. 2 -> K bogus nodes.
	// Distances: 1 is at dist 1, 2 at dist 2 (cap 50), bogus at dist 3 (cap 12).
	// Flow to the bogus fan-out must pass through node 2's split edge (cap 50-1=49),
	// so at most 49 bogus nodes can be accepted, no matter how large K is.
	const K = 500;
	const from: number[] = [];
	const to: number[] = [];
	from.push(0);
	to.push(1); // seed -> good
	from.push(1);
	to.push(2); // good -> bad (bottleneck)
	for (let i = 0; i < K; i++) {
		from.push(2);
		to.push(3 + i); // bad -> bogus fan-out
	}
	const g = { nodeCount: 3 + K, edgeFrom: from, edgeTo: to, seeds: [0] };
	const { accepted } = computeAccepted(g, SCHEDULE);

	expect(accepted[0]).toBe(1); // seed accepted
	expect(accepted[1]).toBe(1); // good node accepted
	expect(accepted[2]).toBe(1); // the bad node itself is reachable -> accepted

	let bogus = 0;
	for (let i = 0; i < K; i++) bogus += accepted[3 + i];
	// the whole point: bounded by node 2's onward budget, NOT by K
	expect(bogus).toBeLessThanOrEqual(49);
	expect(bogus).toBeGreaterThan(0);
	expect(bogus).toBeLessThan(K);
});
