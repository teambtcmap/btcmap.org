import type { Map as LeafletMap } from 'leaflet';
import type { Leaflet } from '$lib/types';

export interface PanelWidths {
	listWidth: number;
	drawerWidth: number;
}

export interface Coordinates {
	lat: number;
	lon: number;
}

// Pan map to show a location if it's hidden behind side panels
export function panToLocationIfNeeded(
	map: LeafletMap,
	leaflet: Leaflet,
	coords: Coordinates,
	panels: PanelWidths,
	padding: number = 50
): void {
	const point = map.latLngToContainerPoint([coords.lat, coords.lon]);
	const mapSize = map.getSize();

	const leftOffset = panels.listWidth + panels.drawerWidth;

	// Effective visible bounds with padding
	const effectiveBounds = {
		left: leftOffset + padding,
		right: mapSize.x - padding,
		top: padding,
		bottom: mapSize.y - padding
	};

	// Check if marker is outside effective bounds
	const isOutside =
		point.x < effectiveBounds.left ||
		point.x > effectiveBounds.right ||
		point.y < effectiveBounds.top ||
		point.y > effectiveBounds.bottom;

	if (isOutside) {
		// Calculate the center of the effective visible area
		const effectiveCenterX = leftOffset + (mapSize.x - leftOffset) / 2;
		const effectiveCenterY = mapSize.y / 2;

		// Calculate offset needed to put marker at effective center
		const offsetX = point.x - effectiveCenterX;
		const offsetY = point.y - effectiveCenterY;

		// Get current center and apply offset
		const currentCenter = map.getCenter();
		const currentCenterPoint = map.latLngToContainerPoint(currentCenter);
		const newCenterPoint = leaflet.point(
			currentCenterPoint.x + offsetX,
			currentCenterPoint.y + offsetY
		);
		const newCenter = map.containerPointToLatLng(newCenterPoint);

		map.panTo(newCenter, { animate: true, duration: 0.3 });
	}
}
