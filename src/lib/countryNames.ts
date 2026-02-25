import countries from "i18n-iso-countries";

const loadedLocales = new Set<string>();

const localeMap = {
	en: "en",
	"pt-BR": "pt",
	bg: "bg",
} as const;

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
			const localeModule = await import(
				`i18n-iso-countries/langs/${countryLocale}.json`
			);
			countries.registerLocale(localeModule.default);
			loadedLocales.add(countryLocale);
		}

		const translated = countries.getName(code.toUpperCase(), countryLocale);
		return translated ?? fallback;
	} catch {
		return fallback;
	}
}
