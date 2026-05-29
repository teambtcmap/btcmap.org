import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";

import {
	BASEMAPS,
	buildRasterStyle,
	defaultBasemap,
	isBasemapId,
	styleForBasemap,
} from "./basemaps";

describe("basemaps catalog", () => {
	it("offers the five legacy basemaps in legacy order", () => {
		expect(BASEMAPS.map((b) => b.id)).toEqual([
			"liberty",
			"ofm-dark",
			"carto-positron",
			"carto-dark-matter",
			"osm",
		]);
	});

	it("uses the legacy picker labels verbatim", () => {
		expect(BASEMAPS.map((b) => b.label)).toEqual([
			"OpenFreeMap Liberty",
			"OpenFreeMap Dark",
			"Carto Positron",
			"Carto Dark Matter",
			"OpenStreetMap",
		]);
	});
});

describe("isBasemapId", () => {
	it("accepts every catalog id", () => {
		for (const { id } of BASEMAPS) {
			expect(isBasemapId(id)).toBe(true);
		}
	});

	it("rejects unknown ids, including the retired migration-era ones", () => {
		for (const id of ["openfreemap", "carto-light", "carto-dark", "", "OSM"]) {
			expect(isBasemapId(id)).toBe(false);
		}
	});
});

describe("defaultBasemap", () => {
	it("matches the legacy first-visit defaults (Liberty light, Carto Dark Matter dark)", () => {
		expect(defaultBasemap("light")).toBe("liberty");
		expect(defaultBasemap(undefined)).toBe("liberty");
		expect(defaultBasemap("dark")).toBe("carto-dark-matter");
	});
});

describe("styleForBasemap", () => {
	it("returns the vector style URL for the four vector basemaps", () => {
		expect(styleForBasemap("liberty")).toBe(
			"https://tiles.openfreemap.org/styles/liberty",
		);
		expect(styleForBasemap("ofm-dark")).toBe(
			"https://static.btcmap.org/map-styles/dark.json",
		);
		expect(styleForBasemap("carto-positron")).toBe(
			"https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
		);
		expect(styleForBasemap("carto-dark-matter")).toBe(
			"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
		);
	});

	it("returns an inline raster StyleSpecification for OSM", () => {
		const style = styleForBasemap("osm");
		expect(typeof style).not.toBe("string");
		const spec = style as StyleSpecification;
		expect(spec.version).toBe(8);
		expect(spec.sources.osm).toBeDefined();
		expect(spec.layers).toHaveLength(1);
		expect(spec.layers[0].id).toBe("osm");
	});
});

describe("buildRasterStyle", () => {
	it("declares the OSM raster source with OSM attribution and maxzoom 19", () => {
		const style = buildRasterStyle();
		const src = style.sources.osm as {
			type: string;
			attribution?: string;
			maxzoom?: number;
		};
		expect(src.type).toBe("raster");
		expect(src.maxzoom).toBe(19);
		expect(src.attribution).toContain("OpenStreetMap");
	});

	it("does not bake the supporter link into tile attribution (it is a customAttribution now)", () => {
		const style = buildRasterStyle();
		const src = style.sources.osm as { attribution?: string };
		expect(src.attribution ?? "").not.toContain("Support BTC Map");
	});
});
