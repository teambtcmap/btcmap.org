import type { LatLngBounds, Marker } from 'leaflet';
import type { FeatureGroup } from 'leaflet';

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

export type CleanupMarkersOptions = {
	loadedMarkers: LoadedMarkers;
	upToDateLayer: FeatureGroup.SubGroup;
	boostedLayer: FeatureGroup;
	boostedLayerMarkerIds: Set<string>;
	bounds: LatLngBounds;
};

// Remove markers that are no longer in viewport
export const cleanupOutOfBoundsMarkers = ({
	loadedMarkers,
	upToDateLayer,
	boostedLayer,
	boostedLayerMarkerIds,
	bounds
}: CleanupMarkersOptions): string[] => {
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
