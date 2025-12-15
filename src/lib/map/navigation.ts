import { BREAKPOINTS, MERCHANT_DRAWER_WIDTH } from '$lib/constants';
import type { Leaflet, Place } from '$lib/types';
import type { Map, MarkerClusterGroup } from 'leaflet';
import type { LoadedMarkers } from './markers';

// Calculate drawer width offset for map centering (desktop only - mobile drawer is at bottom)
export const calculateDrawerOffset = (map: Map, isDrawerOpen: boolean) => {
	const mapSize = map.getSize();
	const isDesktop = mapSize.x >= BREAKPOINTS.md;
	const drawerWidth = isDesktop && isDrawerOpen ? MERCHANT_DRAWER_WIDTH : 0;
	const visibleCenterX = (mapSize.x - drawerWidth) / 2;
	return { drawerWidth, visibleCenterX, mapSize };
};

// Navigate map to a place with drawer offset compensation
export const navigateToPlace = (
	map: Map,
	leaflet: Leaflet,
	place: Place,
	isDrawerOpen: boolean,
	options: { targetZoom?: number; spiderfyCluster?: boolean } = {}
): void => {
	if (!map) return;

	const { visibleCenterX, mapSize } = calculateDrawerOffset(map, isDrawerOpen);
	const { targetZoom, spiderfyCluster = false } = options;

	if (targetZoom !== undefined) {
		// Zoom to specific level: calculate offset at target zoom
		const offsetX = mapSize.x / 2 - visibleCenterX;
		const targetPoint = map.project([place.lat, place.lon], targetZoom);
		const offsetPoint = leaflet.point(targetPoint.x + offsetX, targetPoint.y);
		const offsetLatLng = map.unproject(offsetPoint, targetZoom);
		map.setView(offsetLatLng, targetZoom, { animate: true, duration: 0.3 });
	} else {
		// Pan only: calculate offset at current zoom
		const targetPoint = map.latLngToContainerPoint([place.lat, place.lon]);
		const offsetX = targetPoint.x - visibleCenterX;
		const offsetY = targetPoint.y - mapSize.y / 2;

		const currentCenter = map.getCenter();
		const currentCenterPoint = map.latLngToContainerPoint(currentCenter);
		const newCenterPoint = leaflet.point(
			currentCenterPoint.x + offsetX,
			currentCenterPoint.y + offsetY
		);
		const newCenter = map.containerPointToLatLng(newCenterPoint);
		map.panTo(newCenter, { animate: true, duration: 0.3 });
	}

	// Note: spiderfyCluster logic should be handled by caller as it needs access
	// to boostedLayerMarkerIds and loadedMarkers state
	if (spiderfyCluster) {
		console.info('Spiderfy requested - caller should handle cluster spiderfying');
	}
};

// Spiderfy the cluster containing a marker (if applicable)
export const spiderfyClusterForMarker = (
	clusterGroup: MarkerClusterGroup,
	loadedMarkers: LoadedMarkers,
	placeId: number
): void => {
	const marker = loadedMarkers[placeId.toString()];
	if (marker && clusterGroup) {
		const cluster = clusterGroup.getVisibleParent(marker);
		if (cluster && cluster !== marker && 'spiderfy' in cluster) {
			(cluster as { spiderfy: () => void }).spiderfy();
		}
	}
};
