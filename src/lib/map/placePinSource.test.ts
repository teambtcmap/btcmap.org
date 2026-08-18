import type { Map as MapLibreMap } from "maplibre-gl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HEATMAP_STORAGE_KEY } from "$lib/map/heatmap";
import type { Place } from "$lib/types";

const { ensureSpritesMock } = vi.hoisted(() => ({
	ensureSpritesMock: vi.fn(),
}));

vi.mock("$lib/map/maplibreSprites", async (importOriginal) => ({
	...(await importOriginal<object>()),
	ensureSpritesForPlaces: ensureSpritesMock,
	loadSvgImage: vi.fn(),
}));

import { createPlacePinSource } from "./placePinSource";

// BOOSTED_CLUSTERING_MAX_ZOOM is 5: boosted places fold into the clustered
// source at integer zoom ≤ 5 and ride the standalone source above it.
const CLUSTERED_ZOOM = 3;
const STANDALONE_ZOOM = 12;

type FakeSource = { setData: ReturnType<typeof vi.fn> };

const makeFakeMap = (zoom: number) => {
	const sources: Record<string, FakeSource> = {
		places: { setData: vi.fn() },
		"places-boosted": { setData: vi.fn() },
		"places-heatmap": { setData: vi.fn() },
	};
	const layoutCalls: [string, string, string][] = [];
	let currentZoom = zoom;
	return {
		sources,
		layoutCalls,
		setZoom: (z: number) => {
			currentZoom = z;
		},
		map: {
			getZoom: () => currentZoom,
			getSource: (id: string) => sources[id],
			getLayer: (_id: string) => true,
			setLayoutProperty: (layer: string, prop: string, value: string) => {
				layoutCalls.push([layer, prop, value]);
			},
		} as unknown as MapLibreMap,
	};
};

const makePlace = (overrides: Partial<Place> = {}): Place =>
	({
		id: 1,
		lat: 10,
		lon: 20,
		icon: "cafe",
		...overrides,
	}) as Place;

const boostedPlace = (id: number): Place =>
	makePlace({
		id,
		boosted_until: new Date(Date.now() + 86_400_000).toISOString(),
	});

const makeSource = (onRendered?: (count: number) => void) =>
	createPlacePinSource({
		getSavedIds: () => new Set<number>([1]),
		getEnrichedCache: () => new Map<number, Place>(),
		getDisplayLang: () => "en",
		onRendered,
	});

const featuresOf = (source: FakeSource) =>
	source.setData.mock.calls[source.setData.mock.calls.length - 1][0].features;

beforeEach(() => {
	ensureSpritesMock.mockClear();
	localStorage.clear();
});

describe("render", () => {
	it("routes boosted places to the standalone source above the clustering zoom", () => {
		const { map, sources } = makeFakeMap(STANDALONE_ZOOM);
		const pin = makeSource();
		pin.render(map, [makePlace({ id: 1 }), boostedPlace(2)]);

		expect(
			featuresOf(sources.places).map(
				(f: { properties: { id: number } }) => f.properties.id,
			),
		).toEqual([1]);
		expect(
			featuresOf(sources["places-boosted"]).map(
				(f: { properties: { id: number } }) => f.properties.id,
			),
		).toEqual([2]);
	});

	it("folds boosted places into the clustered source at low zoom", () => {
		const { map, sources } = makeFakeMap(CLUSTERED_ZOOM);
		const pin = makeSource();
		pin.render(map, [makePlace({ id: 1 }), boostedPlace(2)]);

		expect(featuresOf(sources.places)).toHaveLength(2);
		expect(featuresOf(sources["places-boosted"])).toHaveLength(0);
	});

	it("skips the heatmap source while the heatmap is off, reports the count, loads sprites", () => {
		const { map, sources } = makeFakeMap(STANDALONE_ZOOM);
		const counts: number[] = [];
		const pin = makeSource((count) => counts.push(count));
		const list = [makePlace({ id: 1 }), makePlace({ id: 2 })];
		pin.render(map, list);

		expect(sources["places-heatmap"].setData).not.toHaveBeenCalled();
		expect(counts).toEqual([2]);
		expect(ensureSpritesMock).toHaveBeenCalledWith(map, list, null);
	});

	it("builds feature properties from the injected deps", () => {
		const { map, sources } = makeFakeMap(STANDALONE_ZOOM);
		const enriched = new Map<number, Place>([
			[1, { localized_name: { de: "Café Eins" } } as unknown as Place],
		]);
		const pin = createPlacePinSource({
			getSavedIds: () => new Set([1]),
			getEnrichedCache: () => enriched,
			getDisplayLang: () => "de",
		});
		pin.render(map, [makePlace({ id: 1, name: "Cafe One" })]);

		const [feature] = featuresOf(sources.places);
		expect(feature.properties.name).toBe("Café Eins");
		expect(feature.properties.saved).toBe(true);
		expect(feature.properties.boosted).toBe(false);
	});

	it("carries the boost state in the variant outside issues mode", () => {
		const { map, sources } = makeFakeMap(CLUSTERED_ZOOM);
		const pin = makeSource();
		pin.render(map, [makePlace({ id: 1 }), boostedPlace(2)]);

		const variants = featuresOf(sources.places).map(
			(f: { properties: { variant: string } }) => f.properties.variant,
		);
		expect(variants).toEqual(["r", "b"]);
	});

	it("colors pins by their dominant selected issue in issues mode", () => {
		const { map, sources } = makeFakeMap(STANDALONE_ZOOM);
		const issueCodes = new Set([
			"outdated",
			"not_verified",
			"missing_icon",
		] as const);
		const pin = createPlacePinSource({
			getSavedIds: () => new Set<number>(),
			getEnrichedCache: () => new Map<number, Place>(),
			getDisplayLang: () => "en",
			getIssueCodes: () => issueCodes,
		});
		pin.render(map, [
			// Verified long ago → outdated wins over the missing icon.
			makePlace({ id: 1, icon: undefined, verified_at: "2000-01-01" }),
			// Never verified.
			makePlace({ id: 2, verified_at: undefined }),
		]);

		const variants = featuresOf(sources.places).map(
			(f: { properties: { variant: string } }) => f.properties.variant,
		);
		expect(variants).toEqual(["od", "nv"]);
		expect(ensureSpritesMock).toHaveBeenCalledWith(
			map,
			expect.anything(),
			issueCodes,
		);
	});
});

describe("resyncForZoom", () => {
	it("re-renders only when the zoom crossing actually flips the routing", () => {
		const fake = makeFakeMap(CLUSTERED_ZOOM);
		const pin = makeSource();
		pin.render(fake.map, [makePlace({ id: 1 }), boostedPlace(2)]);
		expect(fake.sources.places.setData).toHaveBeenCalledTimes(1);

		// Same side of the boundary — no re-render
		fake.setZoom(CLUSTERED_ZOOM + 1);
		pin.resyncForZoom(fake.map);
		expect(fake.sources.places.setData).toHaveBeenCalledTimes(1);

		// Crossing the boundary re-renders from the remembered list
		fake.setZoom(STANDALONE_ZOOM);
		pin.resyncForZoom(fake.map);
		expect(fake.sources.places.setData).toHaveBeenCalledTimes(2);
		expect(featuresOf(fake.sources["places-boosted"])).toHaveLength(1);
	});
});

describe("heatmap", () => {
	it("seeds the heatmap source from the last synced list on enable", () => {
		const { map, sources } = makeFakeMap(STANDALONE_ZOOM);
		const pin = makeSource();
		pin.render(map, [makePlace({ id: 1 }), makePlace({ id: 2 })]);
		expect(sources["places-heatmap"].setData).not.toHaveBeenCalled();

		pin.setHeatmapEnabled(map, true);
		expect(featuresOf(sources["places-heatmap"])).toHaveLength(2);

		// While enabled, render refreshes the heatmap with the full list
		pin.render(map, [makePlace({ id: 3 })]);
		expect(featuresOf(sources["places-heatmap"])).toHaveLength(1);
	});

	it("conceals pin layers below the reveal zoom and shows them above it", () => {
		const fake = makeFakeMap(10);
		const pin = makeSource();
		pin.setHeatmapEnabled(fake.map, true);
		const heatmapVis = fake.layoutCalls.find(([l]) => l === "place-heatmap");
		expect(heatmapVis?.[2]).toBe("visible");
		const pinVis = fake.layoutCalls.find(([l]) => l === "unclustered-point");
		expect(pinVis?.[2]).toBe("none");

		// Past the reveal zoom (15.5) pins show through the fading heatmap
		fake.layoutCalls.length = 0;
		fake.setZoom(16);
		pin.applyHeatmapVisibility(fake.map);
		const pinVisHigh = fake.layoutCalls.find(
			([l]) => l === "unclustered-point",
		);
		expect(pinVisHigh?.[2]).toBe("visible");
	});

	it("reads the persisted on state and re-applies it after a style load", () => {
		localStorage.setItem(HEATMAP_STORAGE_KEY, "true");
		const fake = makeFakeMap(10);
		const pin = makeSource();
		pin.refreshHeatmapAfterStyle(fake.map);
		const heatmapVis = fake.layoutCalls.find(([l]) => l === "place-heatmap");
		expect(heatmapVis?.[2]).toBe("visible");
	});
});
