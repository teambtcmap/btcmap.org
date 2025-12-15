import type { Leaflet } from '$lib/types';
import type { LatLngBounds, Marker, MarkerClusterGroup } from 'leaflet';
import type { FeatureGroup } from 'leaflet';
import { generateIcon, generateMarker } from '$lib/map/setup';
import type { ProcessedPlace } from '$lib/workers/map-worker';

export type LoadedMarkers = Record<string, Marker>;

// Clear selection styling from a marker
export const clearMarkerSelection = (loadedMarkers: LoadedMarkers, markerId: number): void => {
	const marker = loadedMarkers[markerId.toString()];
	if (!marker) return;

	const markerIcon = marker.getElement();
	if (markerIcon) {
		markerIcon.classList.remove('selected-marker', 'selected-marker-boosted');
	}
};

// Add selection styling to a marker
export const highlightMarker = (loadedMarkers: LoadedMarkers, markerId: number): void => {
	const marker = loadedMarkers[markerId.toString()];
	if (!marker) return;

	const markerIcon = marker.getElement();
	if (markerIcon) {
		const isBoosted = markerIcon.classList.contains('boosted-icon');
		markerIcon.classList.add(isBoosted ? 'selected-marker-boosted' : 'selected-marker');
	}
};

// Remove markers that are no longer in viewport
export const cleanupOutOfBoundsMarkers = (
	loadedMarkers: LoadedMarkers,
	upToDateLayer: FeatureGroup.SubGroup,
	boostedLayer: FeatureGroup,
	boostedLayerMarkerIds: Set<string>,
	bounds: LatLngBounds
): string[] => {
	const markersToRemove: string[] = [];

	Object.entries(loadedMarkers).forEach(([placeId, marker]) => {
		const markerLatLng = marker.getLatLng();
		if (!bounds.contains(markerLatLng)) {
			if (boostedLayerMarkerIds.has(placeId)) {
				boostedLayer.removeLayer(marker);
				boostedLayerMarkerIds.delete(placeId);
			} else {
				upToDateLayer.removeLayer(marker);
			}
			markersToRemove.push(placeId);
		}
	});

	markersToRemove.forEach((placeId) => {
		delete loadedMarkers[placeId];
	});

	if (markersToRemove.length > 0) {
		console.info(`Cleaned up ${markersToRemove.length} out-of-bounds markers`);
	}

	return markersToRemove;
};

// Process a batch of places and add them to the map
export const processPlaceBatch = (
	batch: ProcessedPlace[],
	leaflet: Leaflet,
	clusterGroup: MarkerClusterGroup,
	boostedLayer: FeatureGroup,
	loadedMarkers: LoadedMarkers,
	boostedLayerMarkerIds: Set<string>,
	onMarkerClick: (id: number) => void,
	selectedMarkerId: number | null,
	shouldClusterBoosted: boolean
): { regularMarkers: Marker[]; boostedMarkers: Marker[] } => {
	const regularMarkersToAdd: Marker[] = [];
	const boostedMarkersToAdd: Marker[] = [];

	batch.forEach((element: ProcessedPlace) => {
		const { iconData } = element;
		const placeId = element.id.toString();

		// Skip if marker already loaded
		if (loadedMarkers[placeId]) return;

		// Generate icon using pre-calculated data from worker
		const divIcon = generateIcon(
			leaflet,
			iconData.iconTmp,
			iconData.boosted,
			iconData.commentsCount
		);

		const marker = generateMarker({
			lat: element.lat,
			long: element.lon,
			icon: divIcon,
			placeId: element.id,
			leaflet,
			verify: true,
			onMarkerClick: (id) => onMarkerClick(Number(id))
		});

		// Route to appropriate layer based on boost status and zoom level
		if (iconData.boosted && !shouldClusterBoosted) {
			boostedMarkersToAdd.push(marker);
			boostedLayerMarkerIds.add(placeId);
		} else {
			regularMarkersToAdd.push(marker);
		}
		loadedMarkers[placeId] = marker;
	});

	// Batch add regular markers to cluster group
	if (regularMarkersToAdd.length > 0 && clusterGroup) {
		clusterGroup.addLayers(regularMarkersToAdd);
	}

	// Add boosted markers to non-clustered layer
	if (boostedMarkersToAdd.length > 0 && boostedLayer) {
		boostedMarkersToAdd.forEach((m) => boostedLayer.addLayer(m));
	}

	// Highlight the selected marker if it was just loaded
	if ((regularMarkersToAdd.length > 0 || boostedMarkersToAdd.length > 0) && selectedMarkerId) {
		highlightMarker(loadedMarkers, selectedMarkerId);
	}

	return { regularMarkers: regularMarkersToAdd, boostedMarkers: boostedMarkersToAdd };
};
