import { register, init, locale, _ } from 'svelte-i18n';

// Register locales with lazy loading
register('en', () => import('./locales/en.json'));
register('pt-BR', () => import('./locales/pt-BR.json'));

// Smart locale detection (mirrors theme detection pattern)
function getInitialLocale(): string {
	if (typeof window !== 'undefined') {
		// 1. Check localStorage for saved preference (highest priority)
		const saved = localStorage.getItem('language');
		if (saved === 'en' || saved === 'pt-BR') {
			return saved;
		}

		// 2. Check browser language (like theme checks system preference)
		const browserLang = navigator.language || navigator.languages?.[0];
		if (browserLang?.startsWith('pt')) {
			return 'pt-BR';
		}
	}

	// 3. Default fallback
	return 'en';
}

// Initialize with smart detection
init({
	fallbackLocale: 'en',
	initialLocale: getInitialLocale()
});

// Export locale store and translation function for components
export { locale, _ };
