import js from '@eslint/js';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import * as svelteParser from 'svelte-eslint-parser';
import * as typescriptParser from '@typescript-eslint/parser';

export default [
	js.configs.recommended,
	...eslintPluginSvelte.configs.recommended,
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: typescriptParser,
				project: './tsconfig.json',
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		ignores: ['.netlify', '.svelte-kit', 'static', 'build']
	}
];
