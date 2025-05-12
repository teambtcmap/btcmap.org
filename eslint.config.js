import js from '@eslint/js';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import * as svelteParser from 'svelte-eslint-parser';
import * as typescriptParser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	...eslintPluginSvelte.configs.recommended,
	{
		// Override the TypeScript ESLint recommended config
		name: 'typescript-eslint/disable-ban-ts-comment',
		rules: {
			'@typescript-eslint/ban-ts-comment': 'warn'
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: typescriptParser,
				project: './tsconfig.json',
				extraFileExtensions: ['.svelte']
			},
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			'svelte/require-each-key': 'warn',
			'svelte/no-dupe-style-properties': 'warn', // mainly because of tailwind (v4 will fix this)
			'@typescript-eslint/no-unused-expressions': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},
	{
		ignores: ['.netlify', '.svelte-kit', 'static', 'build', 'spritesheet-*.ts', 'playwright-report']
	}
);
