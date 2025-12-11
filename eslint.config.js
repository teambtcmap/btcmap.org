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
		name: 'project/typescript-config',
		files: ['**/*.ts'],
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
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
			'svelte/no-unused-svelte-ignore': 'off', // These are used by vite-plugin-svelte/svelte-check, not ESLint
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
