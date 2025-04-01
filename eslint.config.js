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
			'svelte/valid-compile': 'off',
			'svelte/require-each-key': 'off',
			'svelte/no-dupe-style-properties': 'off',
			'svelte/no-dom-manipulating': 'off',
			'svelte/infinite-reactive-loop': 'off',
			'svelte/no-reactive-reassign': 'off',
			'svelte/no-immutable-reactive-statements': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'no-undef': 'off',
			'no-unused-vars': 'off'
		}
	},
	{
		ignores: ['.netlify', '.svelte-kit', 'static', 'build']
	}
);
