import type {
	Feature,
	FeatureCollection,
	GeoJSON,
	Geometry,
	GeometryCollection,
} from "geojson";
import { describe, expect, it } from "vitest";

import { computeBbox } from "./bbox";

describe("computeBbox", () => {
	it("returns a zero-area box for a single Point", () => {
		const point: GeoJSON = { type: "Point", coordinates: [10, 20] };
		expect(computeBbox(point)).toEqual([10, 20, 10, 20]);
	});

	it("walks a Polygon ring", () => {
		const polygon: GeoJSON = {
			type: "Polygon",
			coordinates: [
				[
					[0, 0],
					[4, 0],
					[4, 3],
					[0, 3],
					[0, 0],
				],
			],
		};
		expect(computeBbox(polygon)).toEqual([0, 0, 4, 3]);
	});

	it("walks a MultiPolygon (nested coordinate arrays)", () => {
		const multi: GeoJSON = {
			type: "MultiPolygon",
			coordinates: [
				[
					[
						[0, 0],
						[1, 0],
						[1, 1],
						[0, 0],
					],
				],
				[
					[
						[5, 5],
						[6, 5],
						[6, 7],
						[5, 5],
					],
				],
			],
		};
		expect(computeBbox(multi)).toEqual([0, 0, 6, 7]);
	});

	it("walks a FeatureCollection of mixed geometries", () => {
		const fc: FeatureCollection = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {},
					geometry: { type: "Point", coordinates: [-3, -2] },
				},
				{
					type: "Feature",
					properties: {},
					geometry: {
						type: "LineString",
						coordinates: [
							[1, 1],
							[8, 9],
						],
					},
				},
			],
		};
		expect(computeBbox(fc)).toEqual([-3, -2, 8, 9]);
	});

	it("recurses into a GeometryCollection", () => {
		const gc: GeometryCollection = {
			type: "GeometryCollection",
			geometries: [
				{ type: "Point", coordinates: [2, 2] },
				{
					type: "Polygon",
					coordinates: [
						[
							[-5, -5],
							[10, -5],
							[10, 4],
							[-5, -5],
						],
					],
				},
			],
		};
		expect(computeBbox(gc)).toEqual([-5, -5, 10, 4]);
	});

	it("spans the antimeridian as raw min/max (no normalization)", () => {
		// Two points straddling +/-180: the walker reports the literal extent.
		const fc: FeatureCollection = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {},
					geometry: { type: "Point", coordinates: [179, 10] },
				},
				{
					type: "Feature",
					properties: {},
					geometry: { type: "Point", coordinates: [-179, 12] },
				},
			],
		};
		expect(computeBbox(fc)).toEqual([-179, 10, 179, 12]);
	});

	it("returns null for an empty FeatureCollection", () => {
		const empty: FeatureCollection = {
			type: "FeatureCollection",
			features: [],
		};
		expect(computeBbox(empty)).toBeNull();
	});

	it("returns null when a Feature has null geometry", () => {
		const feature: Feature<Geometry | null> = {
			type: "Feature",
			properties: {},
			geometry: null,
		};
		expect(computeBbox(feature as GeoJSON)).toBeNull();
	});

	it("ignores NaN coordinates and returns null when all are NaN", () => {
		const point: GeoJSON = {
			type: "Point",
			coordinates: [Number.NaN, Number.NaN],
		};
		expect(computeBbox(point)).toBeNull();
	});

	it("skips a NaN point but keeps valid ones in a FeatureCollection", () => {
		const fc: FeatureCollection = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: {},
					geometry: { type: "Point", coordinates: [Number.NaN, 5] },
				},
				{
					type: "Feature",
					properties: {},
					geometry: { type: "Point", coordinates: [3, 4] },
				},
			],
		};
		// The NaN x rejects the whole position; only [3, 4] contributes.
		expect(computeBbox(fc)).toEqual([3, 4, 3, 4]);
	});
});
