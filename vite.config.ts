import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Pin the dev port: 5173 is the common default and is often already taken,
	// and clients/bookmarks expect a stable origin.
	server: { port: 5180, strictPort: true }
});
