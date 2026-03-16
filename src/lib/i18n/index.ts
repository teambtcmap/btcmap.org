import { _, init, locale, register } from "svelte-i18n";

// Register locales with lazy loading
register("en", () => import("./locales/en.json"));
register("de", () => import("./locales/de.json"));
register("pt-BR", () => import("./locales/pt-BR.json"));
register("bg", () => import("./locales/bg.json"));
register("ru", () => import("./locales/ru.json"));

export const SUPPORTED_LOCALES = ["en", "de", "pt-BR", "bg", "ru"] as const;

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
export { _, locale };

// Returns the best language code to use for localized name lookups.
// Uses the app locale when non-English (e.g. pt-BR, bg, ru).
// When the app locale is English (whether by default or explicit choice),
// falls back to navigator.language so users with non-English browsers can
// still see localized place names even when the UI has no translation for
// their language. Returns "en" when both resolve to English.
export function getDisplayLang(appLocale: string | null | undefined): string {
	const effectiveLocale = appLocale ?? "en";
	if (!effectiveLocale.startsWith("en")) {
		return effectiveLocale.split(/[-_]/)[0] || "en";
	}
	if (typeof window !== "undefined") {
		const browserLang = navigator.language || navigator.languages?.[0];
		if (browserLang && !browserLang.startsWith("en")) {
			return browserLang.split(/[-_]/)[0] || "en";
		}
	}
	return "en";
}
