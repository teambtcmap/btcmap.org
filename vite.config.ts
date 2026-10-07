import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		// SvelteKit 3 takes its config here; there is no svelte.config.js
		sveltekit({
			preprocess: vitePreprocess(),
			adapter: adapter(),
			// Deprecated in Kit 3 in favour of subpath imports (like #lib);
			// kept until $components/$types move over
			alias: {
				$components: 'src/components',
				'$components/*': 'src/components/*',
				$types: 'src/types',
				'$types/*': 'src/types/*'
			},
			serviceWorker: {
				register: true,
				options: {
					scope: '/'
				}
			}
		})
	],
	ssr: {
		// Force the TanStack packages (and match-sorter's transitive
		// remove-accents) INTO the server bundle. Most are transitive deps,
		// so with pnpm's strict layout they have no top-level node_modules
		// entry — if Vite externalizes them (which happens when the build
		// environment hoists, e.g. Netlify), the serverless function tries
		// to resolve them at runtime and crashes with missing-export /
		// module-not-found errors. v9 is also ESM-only, so the external
		// path is unproven on the lambda runtime — inline all of it.
		// svelte-sonner and its transitive dep runed are Svelte libraries that
		// vite-plugin-svelte normally inlines on its own — pinned here so the
		// lambda never depends on that heuristic.
		noExternal: [/^@tanstack\//, 'remove-accents', 'svelte-sonner', 'runed']
	},
	worker: {
		format: 'es'
	},
	server: {
		host: '0.0.0.0',
		port: 5000,
		allowedHosts: true,
		proxy: {
			// Dev-only proxy for testing against a local btcmap-api instance.
			// Set VITE_API_BASE_URL=/btcmap-api-proxy in .env, then start the
			// API with `cargo run` (binds to 127.0.0.1:8000 by default).
			'/btcmap-api-proxy': {
				target: 'http://127.0.0.1:8000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/btcmap-api-proxy/, ''),
			},
		},
	}
});
