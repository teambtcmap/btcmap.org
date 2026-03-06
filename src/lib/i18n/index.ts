import { _, init, locale, register } from "svelte-i18n";

// Register locales with lazy loading
register("en", () => import("./locales/en.json"));
register("pt-BR", () => import("./locales/pt-BR.json"));
register("bg", () => import("./locales/bg.json"));
register("ru", () => import("./locales/ru.json"));

export const SUPPORTED_LOCALES = ["en", "pt-BR", "bg", "ru"] as const;

export function isSupportedLocale(
	lang: string,
): lang is (typeof SUPPORTED_LOCALES)[number] {
	return (SUPPORTED_LOCALES as readonly string[]).includes(lang);
}

// Smart locale detection (mirrors theme detection pattern)
function getInitialLocale(): string {
	if (typeof window !== "undefined") {
		// 1. Check localStorage for saved preference (highest priority)
		const saved = localStorage.getItem("language");
		if (saved && isSupportedLocale(saved)) {
			return saved;
		}

		// 2. Check browser language (like theme checks system preference)
		const browserLang = navigator.language || navigator.languages?.[0];
		if (browserLang?.startsWith("bg")) return "bg";
		if (browserLang?.startsWith("pt")) return "pt-BR";
		if (browserLang?.startsWith("ru")) return "ru";
	}

	// 3. Default fallback
	return "en";
}

// Initialize with smart detection
init({
	fallbackLocale: "en",
	initialLocale: getInitialLocale(),
});

// Export locale store and translation function for components
export { locale, _ };
