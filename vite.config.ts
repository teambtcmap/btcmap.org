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
			'/local-api': {
				target: 'http://127.0.0.1:8000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/local-api/, '')
			}
		}
	}
});
