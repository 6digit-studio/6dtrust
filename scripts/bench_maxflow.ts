// Synthetic-scale benchmark for the trust max-flow engine.
// Usage: bun scripts/bench_maxflow.ts          (runs the default sweep)
//        bun scripts/bench_maxflow.ts 1000000 10000000 5   (n, m, seedCount)
import { computeAccepted } from '../src/lib/server/trust/maxflow';

// deterministic PRNG so runs are reproducible
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function genGraph(n: number, m: number, seedCount: number) {
	const rng = mulberry32(42);
	const edgeFrom = new Int32Array(m);
	const edgeTo = new Int32Array(m);
	for (let i = 0; i < m; i++) {
		edgeFrom[i] = (rng() * n) | 0;
		edgeTo[i] = (rng() * n) | 0;
	}
	const seeds: number[] = [];
	for (let i = 0; i < seedCount; i++) seeds.push(i);
	return { nodeCount: n, edgeFrom, edgeTo, seeds };
}

function run(n: number, m: number, seedCount: number) {
	const tGen = performance.now();
	const g = genGraph(n, m, seedCount);
	const genMs = performance.now() - tGen;

	const t0 = performance.now();
	const { acceptedCount } = computeAccepted(g);
	const ms = performance.now() - t0;

	const heap = (process.memoryUsage().heapUsed / 1e6).toFixed(0);
	console.log(
		`nodes=${n.toLocaleString()}  edges=${m.toLocaleString()}  seeds=${seedCount}  ` +
			`accepted=${acceptedCount.toLocaleString()}  gen=${genMs.toFixed(0)}ms  ` +
			`compute=${ms.toFixed(0)}ms  heap=${heap}MB`
	);
}

const argv = process.argv.slice(2);
if (argv.length >= 2) {
	run(Number(argv[0]), Number(argv[1]), Number(argv[2] ?? 5));
} else {
	const sweep: Array<[number, number]> = [
		[100_000, 1_000_000],
		[500_000, 5_000_000],
		[1_000_000, 10_000_000],
		[2_000_000, 20_000_000]
	];
	for (const [n, m] of sweep) run(n, m, 5);
}
