// Preload shim: lets standalone `bun` scripts import server code that depends on
// SvelteKit's `$env/dynamic/private` virtual module (e.g. src/lib/server/db.ts).
// Maps the virtual module to process.env so the REAL service layer runs unchanged
// outside the SvelteKit runtime. Usage:
//   bun --preload ./scripts/_sveltekit-env-shim.ts scripts/<name>.ts
import { plugin } from 'bun';

plugin({
	name: 'sveltekit-env-dynamic-private',
	setup(build) {
		build.module('$env/dynamic/private', () => ({
			exports: { env: process.env },
			loader: 'object'
		}));
	}
});
