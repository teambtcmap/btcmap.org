import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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
