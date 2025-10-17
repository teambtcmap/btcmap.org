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
	...eslintPluginSvelte.configs['flat/prettier'],
	{
		// Override the TypeScript ESLint recommended config
		name: 'typescript-eslint/disable-ban-ts-comment',
		rules: {
			'@typescript-eslint/ban-ts-comment': 'warn'
		}
	},
	{
		name: 'project/svelte-config',
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
			'svelte/no-dupe-style-properties': 'warn', // mainly because of tailwind (v4 will fix this)
			'@typescript-eslint/no-unused-expressions': 'warn',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},
	{
		name: 'project/no-console',
		files: ['**/*.js', '**/*.ts', '**/*.svelte'],
		rules: {
			'no-console': ['error', { allow: ['info', 'warn', 'error', 'debug'] }]
		}
	},
	{
		ignores: ['.netlify', '.svelte-kit', 'static', 'build', 'spritesheet-*.ts', 'playwright-report']
	}
);
