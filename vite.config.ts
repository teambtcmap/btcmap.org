import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import VitePluginSvgSpritemap from '@spiriit/vite-plugin-svg-spritemap';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePluginSvgSpritemap([
			'./static/icons/socials/*.svg',
			'./static/icons/apps/*.svg',
			'./static/icons/popup/*.svg'
		])
	],
	server: {
		host: '0.0.0.0',
		allowedHosts: ['btcmap.org']
	}
});
