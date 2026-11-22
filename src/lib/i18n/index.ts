import { derived, get, writable } from "svelte/store";
import {
	_,
	addMessages,
	dictionary,
	locale as i18nLocale,
	init,
	register,
} from "svelte-i18n";

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

type LocaleMessages = Parameters<typeof addMessages>[1];

// The locale files load lazily, one request each
const localeLoaders: Record<
	SupportedLocale,
	() => Promise<{ default: LocaleMessages }>
> = {
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

const registerLocale = (code: SupportedLocale) =>
	register(code, () => localeLoaders[code]());
for (const code of SUPPORTED_LOCALES) registerLocale(code);

// svelte-i18n drops a loader from its queue before it runs, so a file that
// failed to load (on a bad network, for example) is never fetched again.
// Before a switch to a locale whose texts are not in, register its loader
// again, so the language switcher retries the download. Only that locale:
// English, the fallback, loads along with every switch while it is queued.
// (svelte-i18n keeps an empty dictionary entry for every registered locale.)
const hasTexts = (code: SupportedLocale) =>
	Object.keys(get(dictionary)[code] ?? {}).length > 0;
const locale: typeof i18nLocale = {
	...i18nLocale,
	set: (code) => {
		if (code && isSupportedLocale(code) && !hasTexts(code)) {
			registerLocale(code);
		}
		return i18nLocale.set(code);
	},
};

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

// True when no locale file could load at start and no locale is set. The
// root layout then shows a reload screen that does not use $_. A later
// switch can still load a locale (a ?language= link): that clears it.
const startFailed = writable(false);
export const localeFailed = derived(
	[startFailed, i18nLocale],
	([failed, current]) => failed && !current,
);

// Loads a locale's texts straight from its file: the same request when
// svelte-i18n is still loading it, a second try when that load failed.
const loadTexts = async (code: SupportedLocale): Promise<boolean> => {
	try {
		const texts = await localeLoaders[code]();
		addMessages(code, texts.default);
		return true;
	} catch {
		return false;
	}
};

// svelte-i18n loads the chosen locale and English, the fallback, in one
// Promise.all, so init() rejects when either file fails to load. The locale
// then stays unset and every $_ throws, which blanked the page (#1658).
// Keep the chosen locale when its texts are in, else fall back to English,
// and switch only once the texts are in: before, the page showed raw keys.
// A ?language= link can set a locale while these texts load: keep that one.
// The saved choice stays, so the next visit tries it again.
const startLocale = async (
	loading: Promise<void> | void,
	chosen: SupportedLocale,
): Promise<void> => {
	try {
		await loading;
		return;
	} catch (error) {
		console.warn("Could not load the locale:", error);
	}
	for (const code of new Set<SupportedLocale>([chosen, "en"])) {
		if (await loadTexts(code)) {
			if (!get(i18nLocale)) await i18nLocale.set(code);
			return;
		}
	}
	startFailed.set(true);
};

// Initialize with smart detection
const initialLocale = getInitialLocale();
startLocale(init({ fallbackLocale: "en", initialLocale }), initialLocale);

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
