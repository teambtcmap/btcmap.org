import countries from "i18n-iso-countries";
import bg from "i18n-iso-countries/langs/bg.json";
import en from "i18n-iso-countries/langs/en.json";
import pt from "i18n-iso-countries/langs/pt.json";

countries.registerLocale(en);
countries.registerLocale(pt);
countries.registerLocale(bg);

const localeMap = {
	en: "en",
	"pt-BR": "pt",
	bg: "bg",
} as const;

export function getCountryName(
	code: string,
	locale: string,
	fallback: string,
): string {
	const countryLocale = localeMap[locale as keyof typeof localeMap] ?? "en";
	const translated = countries.getName(code.toUpperCase(), countryLocale);
	return translated ?? fallback;
}
