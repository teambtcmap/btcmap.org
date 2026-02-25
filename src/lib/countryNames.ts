import countries from "i18n-iso-countries";

const loadedLocales = new Set<string>();

const localeMap = {
	en: "en",
	"pt-BR": "pt",
	bg: "bg",
} as const;

/** Explicit imports so Vite can bundle; dynamic template imports fail with bare specifiers */
const localeLoaders: Record<
	string,
	() => Promise<{ default: Record<string, string> }>
> = {
	pt: () => import("i18n-iso-countries/langs/pt.json"),
	bg: () => import("i18n-iso-countries/langs/bg.json"),
};

/**
 * Returns the localized country name for a given ISO 3166-1 alpha-2 code.
 * Uses OSM/fallback name for English (avoids long ISO forms like "Bolivia, Plurinational State of").
 * Lazy-loads locale JSON from i18n-iso-countries for non-English locales.
 *
 * @param code - ISO 3166-1 alpha-2 country code (e.g. "ZA", "US")
 * @param locale - App locale ("en", "pt-BR", "bg"); unknown locales fall back to "en"
 * @param fallback - Name to return when translation is unavailable or locale is "en"
 * @returns Promise resolving to the localized country name or fallback
 */
export async function getCountryName(
	code: string,
	locale: string,
	fallback: string,
): Promise<string> {
	try {
		const countryLocale = localeMap[locale as keyof typeof localeMap] ?? "en";

		// Use OSM/fallback name for English - ISO names can be long (e.g. "Bolivia, Plurinational State of")
		if (countryLocale === "en") return fallback;

		if (!loadedLocales.has(countryLocale)) {
			const loader = localeLoaders[countryLocale];
			if (!loader) return fallback;
			const localeModule = await loader();
			countries.registerLocale(localeModule.default);
			loadedLocales.add(countryLocale);
		}

		const translated = countries.getName(code.toUpperCase(), countryLocale);
		return translated ?? fallback;
	} catch {
		return fallback;
	}
}
