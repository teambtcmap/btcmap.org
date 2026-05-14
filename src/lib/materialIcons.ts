// Shared Material Icon name resolution. Used by the Icon component (which
// renders icons via @iconify/svelte) and by the MapLibre sprite pipeline
// (which fetches the SVG from the Iconify API to bake into pin sprites).
// Single source of truth — previously duplicated in Icon.svelte and
// maplibreSprites.ts.

// Maps a place/UI icon name to a fully-qualified Iconify name when the
// default `ic:outline-<name>` form doesn't exist or isn't the one we want.
export const materialExceptions: Record<string, string> = {
	camping: "material-symbols:camping-rounded",
	gate: "material-symbols:gate",
	cooking: "material-symbols:cooking",
	dentistry: "material-symbols:dentistry",
	sauna: "material-symbols:sauna",
	info_outline: "material-symbols:info-outline",
	skull: "material-symbols:skull",
	currency_bitcoin: "material-symbols:currency-bitcoin",
	close_round: "ic:round-close",
	my_location: "material-symbols:my-location-rounded",
	bookmark_filled: "ic:baseline-bookmark-added",
	account_circle_filled: "ic:baseline-account-circle",
	// Missing from ic:outline — fall back to material-symbols
	potted_plant: "material-symbols:potted-plant-outline",
	footprint: "material-symbols:footprint-outline",
	water_pump: "material-symbols:water-pump-outline",
	adult_content: "material-symbols:explicit-outline",
	raven: "material-symbols:raven-outline",
	surgical: "material-symbols:surgical-outline",
};

// Resolves a Material icon name to its Iconify name: an explicit override
// from the table, else the default `ic:outline-<name>` form.
export const resolveMaterialIcon = (icon: string): string =>
	materialExceptions[icon] ?? `ic:outline-${icon.replace(/_/g, "-")}`;
