import { _, init, locale, register } from "svelte-i18n";

export const SUPPORTED_LOCALES = [
	"en",
	"de",
	"pt-BR",
	"bg",
	"ru",
	"nl",
	"fr",
	"es",
	"it",
] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(lang: string): lang is SupportedLocale {
	return (SUPPORTED_LOCALES as readonly string[]).includes(lang);
}

// The locale files load lazily, one request each
export const localeLoaders: Record<SupportedLocale, () => Promise<unknown>> = {
	en: () => import("./locales/en.json"),
	de: () => import("./locales/de.json"),
	"pt-BR": () => import("./locales/pt-BR.json"),
	bg: () => import("./locales/bg.json"),
	ru: () => import("./locales/ru.json"),
	nl: () => import("./locales/nl.json"),
	fr: () => import("./locales/fr.json"),
	es: () => import("./locales/es.json"),
	it: () => import("./locales/it.json"),
};

// svelte-i18n drops a loader from its queue before it runs, so a file that
// failed to load (on a bad network, for example) would never be fetched
// again. Put the loader back on failure: the next switch to it retries.
const registerLocale = (code: SupportedLocale) =>
	register(code, () =>
		localeLoaders[code]().catch((error: unknown) => {
			registerLocale(code);
			throw error;
		}),
	);
for (const code of SUPPORTED_LOCALES) registerLocale(code);

const BROWSER_LOCALE_MAP: Record<string, SupportedLocale> = {
	de: "de",
	bg: "bg",
	pt: "pt-BR",
	ru: "ru",
	nl: "nl",
	fr: "fr",
	es: "es",
	it: "it",
};

// Smart locale detection (mirrors theme detection pattern)
function getInitialLocale(): SupportedLocale {
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

// When the first locale fails to load, svelte-i18n leaves the locale unset
// and every $_ throws, which blanks the page (#1658). Fall back to English
// then. The saved choice stays, so the next visit tries it again.
export const fallBackToEnglish = async (
	loading: Promise<void> | void,
): Promise<void> => {
	try {
		await loading;
	} catch (error) {
		console.warn("Could not load the locale, falling back to English:", error);
		try {
			await locale.set("en");
		} catch (englishError) {
			console.warn("Could not load English either:", englishError);
		}
	}
};

// Initialize with smart detection
fallBackToEnglish(
	init({
		fallbackLocale: "en",
		initialLocale: getInitialLocale(),
	}),
);

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
