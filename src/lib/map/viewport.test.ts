import type { LngLatBounds } from "maplibre-gl";
import { describe, expect, it } from "vitest";

import { calculateRadiusKmFromLngLatBounds, getZoomBehavior } from "./viewport";

// Minimal stub matching the two methods calculateRadiusKmFromLngLatBounds
// reads off LngLatBounds. Cheaper than instantiating MapLibre's real class.
const stubBounds = (
	center: { lat: number; lng: number },
	ne: { lat: number; lng: number },
) =>
	({
		getCenter: () => center,
		getNorthEast: () => ne,
	}) as unknown as LngLatBounds;

describe("getZoomBehavior", () => {
	it('returns "none" for zoom levels below 11', () => {
		expect(getZoomBehavior(1)).toBe("none");
		expect(getZoomBehavior(5)).toBe("none");
		expect(getZoomBehavior(10)).toBe("none");
	});

	it('returns "api-with-limit" for zoom levels 11-14', () => {
		expect(getZoomBehavior(11)).toBe("api-with-limit");
		expect(getZoomBehavior(12)).toBe("api-with-limit");
		expect(getZoomBehavior(14)).toBe("api-with-limit");
	});

	it('returns "local-markers" for zoom levels 15+', () => {
		expect(getZoomBehavior(15)).toBe("local-markers");
		expect(getZoomBehavior(16)).toBe("local-markers");
		expect(getZoomBehavior(17)).toBe("local-markers");
		expect(getZoomBehavior(18)).toBe("local-markers");
		expect(getZoomBehavior(20)).toBe("local-markers");
	});
});

describe("calculateRadiusKmFromLngLatBounds", () => {
	it("returns a positive radius for a standard mid-latitude box", () => {
		// NYC area: center 40°N -74°W, NE corner 41°N -73°W. The corner is
		// roughly 140km from center; we assert in a wide band instead of
		// pinning exact math.
		const r = calculateRadiusKmFromLngLatBounds(
			stubBounds({ lat: 40, lng: -74 }, { lat: 41, lng: -73 }),
		);
		expect(r).toBeGreaterThan(100);
		expect(r).toBeLessThan(160);
	});

	it("returns near-zero for a degenerate bounds (center == ne)", () => {
		const r = calculateRadiusKmFromLngLatBounds(
			stubBounds({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }),
		);
		expect(r).toBe(0);
	});

	it("handles antimeridian-crossing bounds without inflating radius", () => {
		// Fiji-ish: center 179°E, NE corner -179°E. Naive `ne.lng - center.lng`
		// is -358° → enormous radius. Normalized to +2°, the corner is ~220km
		// away at the equator.
		const r = calculateRadiusKmFromLngLatBounds(
			stubBounds({ lat: 0, lng: 179 }, { lat: 1, lng: -179 }),
		);
		expect(r).toBeGreaterThan(150);
		expect(r).toBeLessThan(300);
	});
});
