import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: { exclude: ['@resvg/resvg-js'] },
	server: {
		host: '0.0.0.0',
		allowedHosts: ['btcmap.replit.app', 'btcmap.org']
	}
});
