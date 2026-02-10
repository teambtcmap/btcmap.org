import { register, init, locale } from 'svelte-i18n';

// Register locales with lazy loading
register('en', () => import('./locales/en.json'));
register('pt-BR', () => import('./locales/pt-BR.json'));

// Check localStorage for saved preference
const savedLocale = typeof window !== 'undefined' ? localStorage.getItem('language') : null;

// Initialize with saved preference or default to English
init({
	fallbackLocale: 'en',
	initialLocale: savedLocale === 'en' || savedLocale === 'pt-BR' ? savedLocale : 'en'
});

// Export locale store for components
export { locale };
