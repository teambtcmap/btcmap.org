import { register, init } from 'svelte-i18n';

// Register locales with lazy loading
register('en', () => import('./locales/en.json'));
register('pt-BR', () => import('./locales/pt-BR.json'));

// Initialize with English as default
init({
	fallbackLocale: 'en',
	initialLocale: 'en'
});
