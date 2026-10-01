import type { Locale } from "date-fns";
import { formatDistance } from "date-fns/formatDistance";

// "2 days ago" in the app's language. date-fns locales load on demand, so
// pages that never show a relative date don't ship them.

const LOADERS: Record<string, () => Promise<Locale>> = {
	bg: () => import("date-fns/locale/bg").then((m) => m.bg),
	de: () => import("date-fns/locale/de").then((m) => m.de),
	es: () => import("date-fns/locale/es").then((m) => m.es),
	fr: () => import("date-fns/locale/fr").then((m) => m.fr),
	it: () => import("date-fns/locale/it").then((m) => m.it),
	nl: () => import("date-fns/locale/nl").then((m) => m.nl),
	"pt-BR": () => import("date-fns/locale/pt-BR").then((m) => m.ptBR),
	ru: () => import("date-fns/locale/ru").then((m) => m.ru),
};

// undefined = date-fns' built-in English
export const loadDateLocale = async (
	appLocale: string | null | undefined,
): Promise<Locale | undefined> => {
	if (!appLocale) return undefined;
	const loader = LOADERS[appLocale] ?? LOADERS[appLocale.split(/[-_]/)[0]];
	return loader?.();
};

export const formatRelativeDate = (
	iso: string,
	locale: Locale | undefined,
	now: Date = new Date(),
): string => formatDistance(new Date(iso), now, { addSuffix: true, locale });
