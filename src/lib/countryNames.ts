import countries from "i18n-iso-countries";
import bg from "i18n-iso-countries/langs/bg.json";
import en from "i18n-iso-countries/langs/en.json";
import pt from "i18n-iso-countries/langs/pt.json";

countries.registerLocale(en);
countries.registerLocale(pt);
countries.registerLocale(bg);

const localeMap: Record<string, string> = {
	en: "en",
	"pt-BR": "pt",
	bg: "bg",
};

export function getCountryName(
	code: string,
	locale: string,
	fallback: string,
): string {
	const countryLocale = localeMap[locale] ?? "en";
	const translated = countries.getName(code.toUpperCase(), countryLocale);
	return translated ?? fallback;
}
