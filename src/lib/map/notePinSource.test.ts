import { describe, expect, it, vi } from "vitest";

import {
	installNoteLayer,
	NOTE_LAYER_ID,
	NOTE_SOURCE_ID,
	syncNotes,
	toNoteFeatureCollection,
} from "./notePinSource";
import type { Note } from "$types/btcmap-api/Note";

vi.mock("#lib/map/maplibreSprites.js", () => ({
	ensureSprite: vi.fn(async () => {}),
	spriteName: (icon: string, variant: string) => `pin-${variant}-${icon}`,
}));

const note = (id: number, icon = "notes"): Note => ({
	id,
	lat: 10 + id,
	lon: 20 + id,
	text: "t",
	icon,
	public: false,
	author: { id: 1, name: "a" },
	created_at: "2026-10-01T00:00:00Z",
	updated_at: "2026-10-01T00:00:00Z",
});

// Just enough of a MapLibre map for the source/layer bookkeeping.
const fakeMap = () => {
	const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
	const layers = new Set<string>();
	return {
		sources,
		layers,
		getSource: (id: string) => sources.get(id),
		addSource: vi.fn((id: string) => {
			sources.set(id, { setData: vi.fn() });
		}),
		getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
		addLayer: vi.fn((layer: { id: string }) => {
			layers.add(layer.id);
		}),
	};
};

describe("toNoteFeatureCollection", () => {
	it("puts each note at lon/lat with its id and a safe icon", () => {
		const fc = toNoteFeatureCollection([note(1, "atm"), note(2, "../x")]);

		expect(fc.features).toEqual([
			{
				type: "Feature",
				geometry: { type: "Point", coordinates: [21, 11] },
				properties: { id: 1, icon: "atm" },
			},
			{
				type: "Feature",
				geometry: { type: "Point", coordinates: [22, 12] },
				properties: { id: 2, icon: "notes" },
			},
		]);
	});
});

describe("installNoteLayer", () => {
	it("adds an unclustered source and one symbol layer, once", () => {
		const m = fakeMap();

		installNoteLayer(m as never);
		installNoteLayer(m as never);

		expect(m.addSource).toHaveBeenCalledTimes(1);
		expect(m.addSource).toHaveBeenCalledWith(
			NOTE_SOURCE_ID,
			expect.objectContaining({ type: "geojson", cluster: false }),
		);
		expect(m.addLayer).toHaveBeenCalledTimes(1);
		expect(m.layers.has(NOTE_LAYER_ID)).toBe(true);
	});
});

describe("syncNotes", () => {
	it("shows the notes and loads one sprite per icon", async () => {
		const { ensureSprite } = await import("#lib/map/maplibreSprites.js");
		const m = fakeMap();
		installNoteLayer(m as never);

		syncNotes(m as never, [note(1, "atm"), note(2, "atm"), note(3)], true);

		const data = m.sources.get(NOTE_SOURCE_ID)?.setData.mock.calls[0]?.[0];
		expect(data.features).toHaveLength(3);
		expect(vi.mocked(ensureSprite).mock.calls.map((c) => c.slice(1))).toEqual([
			["atm", "n"],
			["notes", "n"],
		]);
	});

	it("empties the source while hidden", () => {
		const m = fakeMap();
		installNoteLayer(m as never);

		syncNotes(m as never, [note(1)], false);

		const data = m.sources.get(NOTE_SOURCE_ID)?.setData.mock.calls[0]?.[0];
		expect(data.features).toEqual([]);
	});

	it("is a no-op before the source exists", () => {
		const m = fakeMap();

		expect(() => syncNotes(m as never, [note(1)], true)).not.toThrow();
	});
});
