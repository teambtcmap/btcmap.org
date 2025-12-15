import { describe, expect, it } from 'vitest';
import { calculateRadiusKm, getZoomBehavior } from './viewport';

describe('getZoomBehavior', () => {
	it('returns "none" for zoom levels below 11', () => {
		expect(getZoomBehavior(1)).toBe('none');
		expect(getZoomBehavior(5)).toBe('none');
		expect(getZoomBehavior(10)).toBe('none');
	});

	it('returns "api-with-limit" for zoom levels 11-14', () => {
		expect(getZoomBehavior(11)).toBe('api-with-limit');
		expect(getZoomBehavior(12)).toBe('api-with-limit');
		expect(getZoomBehavior(14)).toBe('api-with-limit');
	});

	it('returns "local-markers" for zoom levels 15-16', () => {
		expect(getZoomBehavior(15)).toBe('local-markers');
		expect(getZoomBehavior(16)).toBe('local-markers');
	});

	it('returns "api-extended" for zoom levels 17+', () => {
		expect(getZoomBehavior(17)).toBe('api-extended');
		expect(getZoomBehavior(18)).toBe('api-extended');
		expect(getZoomBehavior(19)).toBe('api-extended');
		expect(getZoomBehavior(20)).toBe('api-extended');
	});
});

describe('calculateRadiusKm', () => {
	// Mock LatLngBounds object
	const createMockBounds = (
		centerLat: number,
		centerLng: number,
		northEastLat: number,
		northEastLng: number
	) => ({
		getCenter: () => ({ lat: centerLat, lng: centerLng }),
		getNorthEast: () => ({ lat: northEastLat, lng: northEastLng })
	});

	it('calculates radius for a small area', () => {
		// Small area around a point (approx 1km span)
		const bounds = createMockBounds(51.5, -0.1, 51.505, -0.095);
		const radius = calculateRadiusKm(bounds as Parameters<typeof calculateRadiusKm>[0]);

		// Should be a small radius (less than 1km)
		expect(radius).toBeGreaterThan(0);
		expect(radius).toBeLessThan(2);
	});

	it('calculates radius for a larger area', () => {
		// Larger area (approx 10km span)
		const bounds = createMockBounds(51.5, -0.1, 51.55, -0.05);
		const radius = calculateRadiusKm(bounds as Parameters<typeof calculateRadiusKm>[0]);

		// Should be a larger radius
		expect(radius).toBeGreaterThan(3);
		expect(radius).toBeLessThan(10);
	});

	it('includes 10% buffer in the calculation', () => {
		// The function multiplies by 1.1 for a buffer
		const bounds = createMockBounds(0, 0, 1, 1);
		const radius = calculateRadiusKm(bounds as Parameters<typeof calculateRadiusKm>[0]);

		// Without buffer would be ~157km, with 10% buffer should be ~173km
		expect(radius).toBeGreaterThan(170);
		expect(radius).toBeLessThan(180);
	});

	it('handles equator coordinates', () => {
		const bounds = createMockBounds(0, 0, 0.01, 0.01);
		const radius = calculateRadiusKm(bounds as Parameters<typeof calculateRadiusKm>[0]);

		// Should return a positive radius
		expect(radius).toBeGreaterThan(0);
	});

	it('handles high latitude coordinates', () => {
		// Near the poles (high latitude)
		const bounds = createMockBounds(70, 10, 70.01, 10.01);
		const radius = calculateRadiusKm(bounds as Parameters<typeof calculateRadiusKm>[0]);

		// Should still return a positive radius
		expect(radius).toBeGreaterThan(0);
	});
});
