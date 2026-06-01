// Compute the bounding box of any GeoJSON object as [minX, minY, maxX, maxY]
// i.e. [west, south, east, north] — the order MapLibre's fitBounds expects via
// [[bbox[0], bbox[1]], [bbox[2], bbox[3]]].
//
// Inlined recursive walker instead of pulling in @turf/bbox — the project does
// not ship that dependency. Lifted from AreaMap / communities/map (which held
// byte-identical copies) and the point-list variant in MultiPlaceMap, which now
// funnels its place points through this generic walker by building a
// FeatureCollection first.
//
// Returns null when no finite coordinate is found (empty input, or geometry
// whose positions are all non-numeric / NaN), so callers can branch to a
// fallback camera (see MultiPlaceMap.fitToPlaces) or skip the fit (see
// AreaMap.fitToArea). NaN coordinates are rejected as a whole position —
// typeof NaN === "number" passes the original type guard, so an all-NaN input
// would otherwise return degenerate infinite bounds instead of null.

import type {
	Feature,
	FeatureCollection,
	GeoJSON,
	Geometry,
	Position,
} from "geojson";

export type Bbox = [number, number, number, number];

export const computeBbox = (g: GeoJSON): Bbox | null => {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;

	const visitPosition = (pos: Position) => {
		const [x, y] = pos;
		if (typeof x !== "number" || typeof y !== "number") return;
		if (Number.isNaN(x) || Number.isNaN(y)) return;
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
		found = true;
	};

	const visitCoords = (coords: unknown) => {
		if (!Array.isArray(coords)) return;
		if (coords.length > 0 && typeof coords[0] === "number") {
			visitPosition(coords as Position);
			return;
		}
		for (const c of coords) visitCoords(c);
	};

	const visitGeometry = (geom: Geometry) => {
		if (geom.type === "GeometryCollection") {
			for (const sub of geom.geometries) visitGeometry(sub);
		} else {
			visitCoords((geom as { coordinates: unknown }).coordinates);
		}
	};

	const visit = (input: GeoJSON) => {
		if (input.type === "FeatureCollection") {
			for (const f of (input as FeatureCollection).features) {
				if (f.geometry) visitGeometry(f.geometry);
			}
		} else if (input.type === "Feature") {
			const f = input as Feature;
			if (f.geometry) visitGeometry(f.geometry);
		} else {
			visitGeometry(input as Geometry);
		}
	};

	visit(g);
	if (!found) return null;
	return [minX, minY, maxX, maxY];
};
