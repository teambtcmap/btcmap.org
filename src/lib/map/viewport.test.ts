import { describe, expect, it } from 'vitest';
import {
	calculateRadiusKm,
	getZoomBehavior,
	getBufferedBounds,
	getVisiblePlaces
} from './viewport';
import type { Place } from '$lib/types';

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

describe('getBufferedBounds', () => {
	// Mock leaflet with latLngBounds factory
	const createMockLeaflet = () => ({
		latLngBounds: (coords: [[number, number], [number, number]]) => ({
			_southWest: { lat: coords[0][0], lng: coords[0][1] },
			_northEast: { lat: coords[1][0], lng: coords[1][1] },
			getSouth: () => coords[0][0],
			getWest: () => coords[0][1],
			getNorth: () => coords[1][0],
			getEast: () => coords[1][1],
			contains: (point: [number, number]) => {
				const [lat, lng] = point;
				return (
					lat >= coords[0][0] && lat <= coords[1][0] && lng >= coords[0][1] && lng <= coords[1][1]
				);
			}
		})
	});

	const createMockBounds = (south: number, west: number, north: number, east: number) => ({
		getSouth: () => south,
		getWest: () => west,
		getNorth: () => north,
		getEast: () => east
	});

	it('expands bounds by buffer percentage', () => {
		const leaflet = createMockLeaflet();
		const bounds = createMockBounds(10, 20, 12, 22); // 2x2 degree box

		const buffered = getBufferedBounds(
			leaflet as unknown as Parameters<typeof getBufferedBounds>[0],
			bounds as unknown as Parameters<typeof getBufferedBounds>[1],
			0.2 // 20% buffer
		);

		// Original span is 2 degrees, 20% buffer = 0.4 degrees on each side
		expect(buffered.getSouth()).toBe(9.6); // 10 - 0.4
		expect(buffered.getNorth()).toBe(12.4); // 12 + 0.4
		expect(buffered.getWest()).toBe(19.6); // 20 - 0.4
		expect(buffered.getEast()).toBe(22.4); // 22 + 0.4
	});

	it('handles zero buffer', () => {
		const leaflet = createMockLeaflet();
		const bounds = createMockBounds(10, 20, 12, 22);

		const buffered = getBufferedBounds(
			leaflet as unknown as Parameters<typeof getBufferedBounds>[0],
			bounds as unknown as Parameters<typeof getBufferedBounds>[1],
			0
		);

		expect(buffered.getSouth()).toBe(10);
		expect(buffered.getNorth()).toBe(12);
	});
});

describe('getVisiblePlaces', () => {
	const createMockLeaflet = () => ({
		latLngBounds: (coords: [[number, number], [number, number]]) => ({
			contains: (point: [number, number]) => {
				const [lat, lng] = point;
				return (
					lat >= coords[0][0] && lat <= coords[1][0] && lng >= coords[0][1] && lng <= coords[1][1]
				);
			}
		})
	});

	const createMockBounds = (south: number, west: number, north: number, east: number) => ({
		getSouth: () => south,
		getWest: () => west,
		getNorth: () => north,
		getEast: () => east
	});

	const createMockPlace = (id: number, lat: number, lon: number): Place =>
		({
			id,
			lat,
			lon
		}) as Place;

	it('filters places within bounds', () => {
		const leaflet = createMockLeaflet();
		const bounds = createMockBounds(10, 20, 12, 22);
		const places = [
			createMockPlace(1, 11, 21), // inside
			createMockPlace(2, 15, 25), // outside
			createMockPlace(3, 10.5, 20.5) // inside
		];

		const visible = getVisiblePlaces(
			leaflet as unknown as Parameters<typeof getVisiblePlaces>[0],
			places,
			bounds as unknown as Parameters<typeof getVisiblePlaces>[2],
			0 // no buffer for simplicity
		);

		expect(visible).toHaveLength(2);
		expect(visible.map((p) => p.id)).toEqual([1, 3]);
	});

	it('returns empty array for empty places', () => {
		const leaflet = createMockLeaflet();
		const bounds = createMockBounds(10, 20, 12, 22);

		const visible = getVisiblePlaces(
			leaflet as unknown as Parameters<typeof getVisiblePlaces>[0],
			[],
			bounds as unknown as Parameters<typeof getVisiblePlaces>[2],
			0
		);

		expect(visible).toHaveLength(0);
	});

	it('applies buffer to include places slightly outside viewport', () => {
		const leaflet = createMockLeaflet();
		const bounds = createMockBounds(10, 20, 12, 22); // 2x2 degree box
		const places = [
			createMockPlace(1, 11, 21), // inside original
			createMockPlace(2, 9.8, 21) // outside original, inside with 20% buffer (0.4 deg)
		];

		const visible = getVisiblePlaces(
			leaflet as unknown as Parameters<typeof getVisiblePlaces>[0],
			places,
			bounds as unknown as Parameters<typeof getVisiblePlaces>[2],
			0.2 // 20% buffer
		);

		expect(visible).toHaveLength(2);
	});
});
