import countries from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";

countries.registerLocale(en);

const registeredLocales = new Set<string>(["en"]);

// Map svelte-i18n locale to i18n-iso-countries locale
const localeMap: Record<string, string> = {
	en: "en",
	"pt-BR": "pt",
	bg: "bg",
};

/** Dynamically load and register a country locale. Call when locale changes. */
export async function loadCountryLocale(uiLocale: string): Promise<void> {
	const countryLocale = localeMap[uiLocale] ?? "en";
	if (registeredLocales.has(countryLocale)) return;

	let mod: { default: Parameters<typeof countries.registerLocale>[0] };
	if (countryLocale === "pt") {
		mod = await import("i18n-iso-countries/langs/pt.json");
	} else if (countryLocale === "bg") {
		mod = await import("i18n-iso-countries/langs/bg.json");
	} else {
		return;
	}
	countries.registerLocale(mod.default);
	registeredLocales.add(countryLocale);
}

// Returns translated country name by ISO 3166-1 alpha-2 code, or fallback if none exists.
export function getCountryName(
	code: string,
	locale: string,
	fallback: string,
): string {
	const countryLocale = localeMap[locale] ?? "en";
	const translated = countries.getName(code.toUpperCase(), countryLocale);
	return translated ?? fallback;
}
