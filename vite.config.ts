import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

import { iconsSpritesheet } from 'vite-plugin-icons-spritesheet';

export default defineConfig({
	plugins: [
		sveltekit(),
		iconsSpritesheet([
			{
				withTypes: true,
				inputDir: './static/icons/socials',
				outputDir: './static/icons',
				typesOutputFile: './src/lib/spritesheet-socials.ts',
				fileName: 'spritesheet-socials.svg',
				iconNameTransformer: (iconName) => iconName.toLowerCase()
			},
			{
				withTypes: true,
				inputDir: './static/icons/apps',
				outputDir: './static/icons',
				typesOutputFile: './src/lib/spritesheet-apps.ts',
				fileName: 'spritesheet-apps.svg',
				iconNameTransformer: (iconName) => iconName.toLowerCase()
			},
			{
				withTypes: true,
				inputDir: './static/icons/popup',
				outputDir: './static/icons',
				typesOutputFile: './src/lib/spritesheet-popup.ts',
				fileName: 'spritesheet-popup.svg',
				iconNameTransformer: (iconName) => iconName.toLowerCase()
			},
			{
				withTypes: true,
				inputDir: './static/icons/mobile-nav',
				outputDir: './static/icons',
				typesOutputFile: './src/lib/spritesheet-mobile-nav.ts',
				fileName: 'spritesheet-mobile-nav.svg',
				iconNameTransformer: (iconName) => iconName.toLowerCase()
			}
		])
	],
	server: {
		host: '0.0.0.0',
		allowedHosts: ['btcmap.org', '.replit.dev', 'replit.app']
	}
});
