import type { Readable } from "svelte/store";
import { derived } from "svelte/store";
import type { Locales } from "svelte-time";

// svelte-time formats with dayjs, which only knows English until a locale
// file registers itself. Load the app language's file on demand and return
// the key to pass as <Time locale>. The locale files require("dayjs"), the
// same single instance svelte-time imports.

const LOADERS: Record<string, { key: Locales; load: () => Promise<unknown> }> =
	{
		bg: { key: "bg", load: () => import("dayjs/locale/bg") },
		de: { key: "de", load: () => import("dayjs/locale/de") },
		es: { key: "es", load: () => import("dayjs/locale/es") },
		fr: { key: "fr", load: () => import("dayjs/locale/fr") },
		it: { key: "it", load: () => import("dayjs/locale/it") },
		nl: { key: "nl", load: () => import("dayjs/locale/nl") },
		"pt-BR": { key: "pt-br", load: () => import("dayjs/locale/pt-br") },
		ru: { key: "ru", load: () => import("dayjs/locale/ru") },
	};

export const loadDayjsLocale = async (
	appLocale: string | null | undefined,
): Promise<Locales> => {
	if (!appLocale) return "en";
	const entry = LOADERS[appLocale] ?? LOADERS[appLocale.split(/[-_]/)[0]];
	if (!entry) return "en";
	await entry.load();
	return entry.key;
};

// The dayjs key for the app's current language, for <Time locale>. Starts
// as "en" and switches once the locale file has loaded; a slower, older
// load can't overwrite a newer one.
export const createTimeLocale = (
	appLocale: Readable<string | null | undefined>,
): Readable<Locales> => {
	let latest = 0;
	return derived<typeof appLocale, Locales>(
		appLocale,
		(code, set) => {
			const request = ++latest;
			loadDayjsLocale(code).then((key) => {
				if (request === latest) set(key);
			});
		},
		"en",
	);
};
