import js from '@eslint/js';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import * as svelteParser from 'svelte-eslint-parser';
import * as typescriptParser from '@typescript-eslint/parser';
import tseslint from 'typescript-eslint';

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
			}
		},
		rules: {
			'svelte/valid-compile': 'warn',
			'svelte/require-each-key': 'warn',
			'svelte/no-dupe-style-properties': 'warn',
			'svelte/no-dom-manipulating': 'warn',
			'svelte/infinite-reactive-loop': 'warn',
			'svelte/no-reactive-reassign': 'warn',
			'svelte/no-immutable-reactive-statements': 'warn',
			'@typescript-eslint/no-unused-expressions': 'warn',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-undef': 'warn',
			'no-unused-vars': 'warn'
		}
	},
	{
		ignores: ['.netlify', '.svelte-kit', 'static', 'build', 'spritesheet-*.ts']
	}
);
