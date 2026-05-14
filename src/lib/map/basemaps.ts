// Raster basemap catalog for /map-next. All three sources/layers are added
// to the style at init; switching is just a layer-visibility toggle, no
// setStyle — which avoids the tile-compile cascade that broke the first
// basemap-switcher attempt.

export type BasemapId = "osm" | "carto-light" | "carto-dark";

export const BASEMAPS: { id: BasemapId; label: string }[] = [
	{ id: "osm", label: "OpenStreetMap" },
	{ id: "carto-light", label: "Carto Light" },
	{ id: "carto-dark", label: "Carto Dark" },
];

export const BASEMAP_STORAGE_KEY = "btcmap-next-basemap";

export const isBasemapId = (v: string): v is BasemapId =>
	v === "osm" || v === "carto-light" || v === "carto-dark";

export const getStoredBasemap = (): BasemapId | null => {
	if (typeof window === "undefined") return null;
	try {
		const v = localStorage.getItem(BASEMAP_STORAGE_KEY);
		if (v && isBasemapId(v)) return v;
	} catch {
		// localStorage unavailable
	}
	return null;
};
