import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

import { ensureSprite } from "#lib/map/maplibreSprites.js";
import { normalizeNoteIcon } from "#lib/noteIcons.js";

import type { Note } from "$types/btcmap-api/Note";

// The signed-in user's notes on /map (#1542): their own GeoJSON source,
// never clustered, so a note is never folded into a merchant cluster, and
// one symbol layer above the place pins. Pins use the "n" sprite variant.

export const NOTE_SOURCE_ID = "notes";
export const NOTE_LAYER_ID = "note-point";

export type NoteFeatureCollection = {
	type: "FeatureCollection";
	features: {
		type: "Feature";
		geometry: { type: "Point"; coordinates: [number, number] };
		properties: { id: Note["id"]; icon: string };
	}[];
};

export const toNoteFeatureCollection = (
	notes: Note[],
): NoteFeatureCollection => ({
	type: "FeatureCollection",
	features: notes.map((n) => ({
		type: "Feature",
		geometry: { type: "Point", coordinates: [n.lon, n.lat] },
		properties: { id: n.id, icon: normalizeNoteIcon(n.icon) },
	})),
});

// Idempotent: runs after every style becomes ready, and a basemap swap's
// fresh style arrives without our source and layer.
export const installNoteLayer = (m: MapLibreMap): void => {
	if (!m.getSource(NOTE_SOURCE_ID)) {
		m.addSource(NOTE_SOURCE_ID, {
			type: "geojson",
			data: toNoteFeatureCollection([]),
			cluster: false,
		});
	}
	if (!m.getLayer(NOTE_LAYER_ID)) {
		m.addLayer({
			id: NOTE_LAYER_ID,
			type: "symbol",
			source: NOTE_SOURCE_ID,
			layout: {
				"icon-image": ["concat", "pin-n-", ["get", "icon"]],
				"icon-anchor": "bottom",
				"icon-allow-overlap": true,
				"icon-ignore-placement": true,
				"icon-rotation-alignment": "viewport",
				"icon-pitch-alignment": "viewport",
			},
		});
	}
};

export const syncNotes = (
	m: MapLibreMap,
	notes: Note[],
	visible: boolean,
): void => {
	const source = m.getSource(NOTE_SOURCE_ID) as GeoJSONSource | undefined;
	if (!source) return;
	const shown = visible ? notes : [];
	source.setData(toNoteFeatureCollection(shown));
	const icons = new Set(shown.map((n) => normalizeNoteIcon(n.icon)));
	for (const icon of icons) {
		ensureSprite(m, icon, "n").catch((err) => {
			console.warn(`ensureSprite failed for note icon ${icon}:`, err);
		});
	}
};
