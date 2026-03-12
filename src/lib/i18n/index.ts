import { _, init, locale, register } from "svelte-i18n";

// Register locales with lazy loading
register("en", () => import("./locales/en.json"));
register("de", () => import("./locales/de.json"));
register("pt-BR", () => import("./locales/pt-BR.json"));
register("bg", () => import("./locales/bg.json"));
register("ru", () => import("./locales/ru.json"));
register("nl", () => import("./locales/nl.json"));

export const SUPPORTED_LOCALES = [
	"en",
	"de",
	"pt-BR",
	"bg",
	"ru",
	"nl",
] as const;

export function isSupportedLocale(
	lang: string,
): lang is (typeof SUPPORTED_LOCALES)[number] {
	return (SUPPORTED_LOCALES as readonly string[]).includes(lang);
}

const BROWSER_LOCALE_MAP: Record<string, string> = {
	de: "de",
	bg: "bg",
	pt: "pt-BR",
	ru: "ru",
	nl: "nl",
};

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
		const prefix = browserLang?.split("-")[0];
		if (prefix && prefix in BROWSER_LOCALE_MAP) {
			return BROWSER_LOCALE_MAP[prefix];
		}
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
