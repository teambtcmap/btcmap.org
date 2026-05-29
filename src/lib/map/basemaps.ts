// Basemap catalog for /map and /communities/map.
//
// Restores the five basemaps the legacy (Leaflet) maps offered, now driven
// natively through MapLibre:
//   • four VECTOR styles — OpenFreeMap Liberty, OpenFreeMap Dark (btcmap's
//     tuned dark.json), Carto Positron, Carto Dark Matter. Each is a whole
//     style document MapLibre fetches by URL.
//   • one RASTER style — OpenStreetMap {z}/{x}/{y} tiles, declared inline.
//
// Each basemap is a FIXED style. The picker persists the choice (sticky), and
// a theme toggle does NOT swap the basemap — only the first-visit default is
// theme-aware (see defaultBasemap), matching the legacy defaults. Switching
// basemaps always goes through map.setStyle({ transformStyle }) so the custom
// pin/cluster/label (or community-polygon) layers ride along; raster↔raster
// no longer applies since OSM is the only raster option.

import type { StyleSpecification } from "maplibre-gl";

export type BasemapId =
	| "liberty"
	| "ofm-dark"
	| "carto-positron"
	| "carto-dark-matter"
	| "osm";

export const BASEMAPS: { id: BasemapId; label: string }[] = [
	{ id: "liberty", label: "OpenFreeMap Liberty" },
	{ id: "ofm-dark", label: "OpenFreeMap Dark" },
	{ id: "carto-positron", label: "Carto Positron" },
	{ id: "carto-dark-matter", label: "Carto Dark Matter" },
	{ id: "osm", label: "OpenStreetMap" },
];

export const BASEMAP_STORAGE_KEY = "btcmap-next-basemap";

// The four vector style documents, fetched by MapLibre via URL. "ofm-dark" is
// btcmap's tuned dark style (also used by the area/merchant/saved maps); the
// Carto pair are Carto's free, key-less GL styles. Each carries its own data
// attribution (OSM / OpenFreeMap / Carto) via its sources.
const VECTOR_STYLE_URLS: Record<Exclude<BasemapId, "osm">, string> = {
	liberty: "https://tiles.openfreemap.org/styles/liberty",
	"ofm-dark": "https://static.btcmap.org/map-styles/dark.json",
	"carto-positron":
		"https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
	"carto-dark-matter":
		"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export const isBasemapId = (v: string): v is BasemapId =>
	v === "liberty" ||
	v === "ofm-dark" ||
	v === "carto-positron" ||
	v === "carto-dark-matter" ||
	v === "osm";

// First-visit default, matching the legacy maps: Liberty in light, Carto Dark
// Matter in dark. Once the user picks from the basemap control that choice is
// persisted (getStoredBasemap) and wins over this.
export const defaultBasemap = (
	theme: "light" | "dark" | undefined,
): BasemapId => (theme === "dark" ? "carto-dark-matter" : "liberty");

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

// "Support BTC Map" supporter link. Legacy /map injected this into the
// attribution bar via DOM mutation regardless of the active basemap; here it
// is passed as the AttributionControl's customAttribution so it shows on both
// the vector and raster basemaps. The data-source credit (OpenStreetMap /
// OpenFreeMap / Carto) is supplied by each style's own sources, so it is NOT
// duplicated here.
export const SUPPORT_ATTR =
	'<a href="/supporters" title="Support BTC Map with sats">Support BTC Map</a>';

const OSM_ATTR =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Inline raster style for the OpenStreetMap basemap — a single {z}/{x}/{y}
// tile source. maxzoom 19 is OSM's native ceiling; MapLibre overzooms past it
// up to the map's maxZoom, matching the legacy maxNativeZoom: 19 behaviour.
export const buildRasterStyle = (): StyleSpecification => ({
	version: 8,
	// OpenFreeMap's public glyph endpoint (Cloudflare R2, no key) so the
	// place-label layer's "Noto Sans Bold" font resolves on the raster
	// basemap too.
	glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
	sources: {
		osm: {
			type: "raster",
			tiles: [
				"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
				"https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
				"https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
			],
			tileSize: 256,
			attribution: OSM_ATTR,
			maxzoom: 19,
		},
	},
	layers: [{ id: "osm", type: "raster", source: "osm" }],
});

// The style for a basemap selection: the vector style URL, or the inline
// raster style for OSM.
export const styleForBasemap = (id: BasemapId): StyleSpecification | string =>
	id === "osm" ? buildRasterStyle() : VECTOR_STYLE_URLS[id];
