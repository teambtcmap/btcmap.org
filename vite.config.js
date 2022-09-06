import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

const config = {
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$comp: path.resolve('src/components/index.js')
		}
	}
};

export default config;
