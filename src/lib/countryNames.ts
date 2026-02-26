import countries, { type LocaleData } from "i18n-iso-countries";

const loadedLocales = new Set<string>();

const localeMap = {
	en: "en",
	"pt-BR": "pt",
	bg: "bg",
} as const;

type CountryLocale = (typeof localeMap)[keyof typeof localeMap];
type NonEnglishCountryLocale = Exclude<CountryLocale, "en">;

// Explicit imports so Vite can bundle; dynamic template imports fail with bare specifiers
const localeLoaders: Record<
	NonEnglishCountryLocale,
	() => Promise<{ default: LocaleData }>
> = {
	pt: () => import("i18n-iso-countries/langs/pt.json"),
	bg: () => import("i18n-iso-countries/langs/bg.json"),
};

// Returns localized country name for an ISO alpha-2 code.
// English falls back to OSM name to avoid long ISO forms (e.g. "Bolivia, Plurinational State of").
// Lazy-loads locale JSON for non-English locales.
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
			const localeModule =
				await localeLoaders[countryLocale as NonEnglishCountryLocale]();
			countries.registerLocale(localeModule.default);
			loadedLocales.add(countryLocale);
		}

		const translated = countries.getName(code.toUpperCase(), countryLocale);
		return translated ?? fallback;
	} catch {
		return fallback;
	}
}
