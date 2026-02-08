import type { Leaflet, Place } from '$lib/types';
import type { Marker, MarkerClusterGroup } from 'leaflet';
import type { FeatureGroup } from 'leaflet';
import type { ProcessedPlace } from '$lib/workers/map-worker';
import type { LoadedMarkers } from '$lib/map/markers';
import { generateIcon, generateMarker } from '$lib/map/setup';
import { attachMarkerLabelIfVisible } from '$lib/map/labels';
import { highlightMarker } from '$lib/map/markers';

type ProcessBatchOptions = {
	batch: ProcessedPlace[];
	leaflet: Leaflet;
	currentZoom: number;
	placeDetailsCache: Map<number, Place>;
	placesById: Map<number, Place>;
	loadedMarkers: LoadedMarkers;
	boostedLayerMarkerIds: Set<string>;
	shouldClusterBoostedMarkers: () => boolean;
	markers: MarkerClusterGroup;
	boostedLayer: FeatureGroup;
	selectedMarkerId: number | null;
	onMarkerClick: (id: number) => void;
};

/**
 * Process a batch of places from the worker and add markers to appropriate layers
 * Performs batch DOM operations for better performance
 */
export const processBatchOnMainThread = ({
	batch,
	leaflet,
	currentZoom,
	placeDetailsCache,
	placesById,
	loadedMarkers,
	boostedLayerMarkerIds,
	shouldClusterBoostedMarkers,
	markers,
	boostedLayer,
	selectedMarkerId,
	onMarkerClick
}: ProcessBatchOptions): void => {
	const regularMarkersToAdd: Marker[] = [];
	const boostedMarkersToAdd: Marker[] = [];

	batch.forEach((element: ProcessedPlace) => {
		const { iconData } = element;
		const placeId = element.id.toString();

		if (loadedMarkers[placeId]) return;

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

		attachMarkerLabelIfVisible(
			marker,
			element.id,
			currentZoom,
			placeDetailsCache,
			placesById,
			Boolean(iconData.boosted),
			leaflet,
			placesById.get(element.id)
		);

		if (iconData.boosted && !shouldClusterBoostedMarkers()) {
			boostedMarkersToAdd.push(marker);
			boostedLayerMarkerIds.add(placeId);
		} else {
			regularMarkersToAdd.push(marker);
		}
		loadedMarkers[placeId] = marker;
	});

	if (regularMarkersToAdd.length > 0 && markers) {
		markers.addLayers(regularMarkersToAdd);
	}

	if (boostedMarkersToAdd.length > 0 && boostedLayer) {
		boostedMarkersToAdd.forEach((m) => boostedLayer.addLayer(m));
	}

	if ((regularMarkersToAdd.length > 0 || boostedMarkersToAdd.length > 0) && selectedMarkerId) {
		highlightMarker(loadedMarkers, selectedMarkerId);
	}
};
