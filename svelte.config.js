import adapter from '@sveltejs/adapter-vercel';
import { mdsvex } from 'mdsvex';

/** mdsvex: prose lives in `.svx` files (frontmatter + markdown + the full
 * Svelte escape hatch, so an evergreen article can still drop an inline SVG
 * diagram the way /about does). `.svx` is registered as a compilable extension
 * below so the Svelte compiler picks the files up. */
const mdsvexConfig = {
	extensions: ['.svx']
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.svx'],
	preprocess: [mdsvex(mdsvexConfig)],
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Vercel adapter. Node.js serverless runtime — which is what we need: the
		// Postgres driver opens a real TCP socket, and Vercel's Edge runtime can't
		// provide one. We do NOT opt routes into `runtime: 'edge'` anywhere for that
		// reason. Explicit Vercel target (vs adapter-auto) so regions / function
		// config are ours to set when we want them.
		//
		// `runtime` is pinned so the deployed Lambda is deterministic instead of
		// inheriting whatever Node the build host runs. Without it the adapter
		// derives the runtime from the build-host Node version and HARD-ERRORS on
		// anything outside Vercel's supported set (e.g. a local Node 25 / Bun build
		// fails: "Unsupported Node.js version"). Pinning decouples the local build
		// from the prod runtime. Valid: nodejs20.x | nodejs22.x | nodejs24.x.
		adapter: adapter({ runtime: 'nodejs22.x' }),

		// Content-Security-Policy (security S8). `mode: 'auto'` lets SvelteKit hash
		// its own inline hydration scripts, so script-src stays 'self' without
		// breaking hydration. style-src allows inline (Svelte/Tailwind inject style
		// attributes); img-src allows data: (badge avatar data-URIs) and https:
		// (root avatars). frame-src whitelists the YouTube embed domains for the
		// hero intro video (default-src 'self' would otherwise block the iframe).
		// The dangerous knobs are locked: no object/embed, OUR pages can't be
		// framed (frame-ancestors none), base/form pinned to self.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'https:'],
				'font-src': ['self', 'data:'],
				'connect-src': ['self'],
				'frame-src': ['https://www.youtube-nocookie.com', 'https://www.youtube.com'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self'],
				'frame-ancestors': ['none']
			}
		}
	}
};

export default config;
