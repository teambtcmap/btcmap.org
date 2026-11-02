// Note icons are Material Symbols names (Android picks them from the
// outlined Material Symbols font), stored verbatim by the API. The web
// renders them from Iconify's material-symbols set, NOT through
// resolveMaterialIcon: its `ic:outline-*` default covers only about half of
// the names Android offers.

// Note pins' body colour, shared by the map sprite (PIN_FILLS.n) and the
// card/list chips. Notes share the map with merchants and have no filter, so
// the hue must not read as a place.
export const NOTE_PIN_COLOR = "#4F46E5"; // indigo-600

// The API's own default, and the glyph any unrenderable icon falls back to.
export const DEFAULT_NOTE_ICON = "notes";

// The web picker's choices, default first. Bundled offline by
// `pnpm icons:generate` (scripts/generate-icons.mjs parses this list), so
// picking never hits the network. Android offers every symbol; a note it
// made with an icon outside this list still renders, it just can't be
// picked here.
export const NOTE_ICONS = [
	"notes",
	"star",
	"favorite",
	"bookmark",
	"flag",
	"push_pin",
	"home",
	"work",
	"atm",
	"local_atm",
	"payments",
	"currency_bitcoin",
	"bolt",
	"storefront",
	"restaurant",
	"local_cafe",
	"local_bar",
	"shopping_cart",
	"local_parking",
	"local_gas_station",
	"ev_station",
	"hotel",
	"local_hospital",
	"wc",
	"wifi",
	"info",
	"warning",
	"schedule",
	"lock",
	"person",
	"groups",
	"chat",
	"photo_camera",
	"directions_bus",
];

// Plain symbol names only: the icon is free text from any client and ends up
// in sprite names and Iconify URLs.
const SYMBOL_NAME = /^[a-z0-9_]+$/;

export const normalizeNoteIcon = (icon: string): string =>
	SYMBOL_NAME.test(icon) ? icon : DEFAULT_NOTE_ICON;

const DEFAULT_CANDIDATE = `material-symbols:${DEFAULT_NOTE_ICON}-outline`;

// Iconify names to try in order: the outlined glyph Android draws, the base
// name (the only form for symbols whose outlined and filled glyphs are the
// same), then the default.
export const noteIconCandidates = (icon: string): string[] => {
	if (!SYMBOL_NAME.test(icon)) return [DEFAULT_CANDIDATE];
	const name = `material-symbols:${icon.replaceAll("_", "-")}`;
	const own = [`${name}-outline`, name];
	return icon === DEFAULT_NOTE_ICON ? own : [...own, DEFAULT_CANDIDATE];
};

type IconStore = {
	loaded: (name: string) => boolean;
	load: (name: string) => Promise<unknown>;
};

// The glyph to paint before any request: only the first candidate. A
// bundled later one (the default always is) must not win over an earlier
// one that hasn't had its load attempt yet, or an Android-picked icon
// outside the bundle never renders (#1605).
export const readyNoteIcon = (
	candidates: string[],
	loaded: IconStore["loaded"],
): string | null => {
	const [first] = candidates;
	return first !== undefined && loaded(first) ? first : null;
};

// Walk the candidates in order, as the map's pin sprites do: a loaded name
// answers without a request, an unloaded one gets its load attempt before the
// walk moves on. Null only if even the default fails.
export const resolveNoteIcon = async (
	candidates: string[],
	{ loaded, load }: IconStore,
): Promise<string | null> => {
	for (const name of candidates) {
		if (loaded(name)) return name;
		try {
			await load(name);
			return name;
		} catch {
			// Not in the set (or unreachable): try the next candidate
		}
	}
	return null;
};
