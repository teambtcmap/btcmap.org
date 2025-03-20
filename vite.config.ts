import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: { exclude: ['@resvg/resvg-js'] },
	server: {
		host: '0.0.0.0',
		allowedHosts: ['btcmap.replit.app', 'btcmap.org','e5530b97-b69a-4a8e-b94e-e1dd4c0d2083-00-g1t1d8adcg1t.worf.replit.dev']
	}
});
