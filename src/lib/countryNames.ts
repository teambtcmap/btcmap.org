import countries from "i18n-iso-countries";
import bg from "i18n-iso-countries/langs/bg.json";
import en from "i18n-iso-countries/langs/en.json";
import pt from "i18n-iso-countries/langs/pt.json";

countries.registerLocale(en);
countries.registerLocale(pt);
countries.registerLocale(bg);

// Map svelte-i18n locale to i18n-iso-countries locale
const localeMap: Record<string, string> = {
	en: "en",
	"pt-BR": "pt",
	bg: "bg",
};

// Returns translated country name by ISO 3166-1 alpha-2 code, or fallback if none exists.
export function getCountryName(
	code: string,
	locale: string,
	fallback: string,
): string {
	const countryLocale = localeMap[locale] || "en";
	const translated = countries.getName(code.toUpperCase(), countryLocale);
	return translated || fallback;
}
