import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		globals: true,
		environment: 'jsdom',
		exclude: ['**/node_modules/**', '**/tests/**']
	},
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			$components: path.resolve('./src/components'),
			$app: path.resolve('./node_modules/@sveltejs/kit/src/runtime/app')
		}
	}
});
