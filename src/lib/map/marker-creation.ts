import type { Leaflet, Place } from '$lib/types';
import type { Marker } from 'leaflet';
import { generateIcon, generateMarker } from '$lib/map/setup';
import { attachMarkerLabelIfVisible } from '$lib/map/labels';

type CreateMarkerOptions = {
	place: Place;
	leaflet: Leaflet;
	currentZoom: number;
	placeDetailsCache: Map<number, Place>;
	placesById: Map<number, Place>;
	onMarkerClick: (id: number) => void;
	onLabelUpdate?: () => void;
};

/**
 * Creates a Leaflet marker with icon and optional label
 * Encapsulates the common pattern used in worker and fallback paths
 */
export const createMarkerWithLabel = ({
	place,
	leaflet,
	currentZoom,
	placeDetailsCache,
	placesById,
	onMarkerClick,
	onLabelUpdate
}: CreateMarkerOptions): { marker: Marker; boosted: boolean } => {
	const commentsCount = place.comments || 0;
	const icon = place.icon;
	const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

	const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);

	const marker = generateMarker({
		lat: place.lat,
		long: place.lon,
		icon: divIcon,
		placeId: place.id,
		leaflet,
		verify: true,
		onMarkerClick: (id) => onMarkerClick(Number(id))
	});

	attachMarkerLabelIfVisible(
		marker,
		place.id,
		currentZoom,
		placeDetailsCache,
		placesById,
		boosted,
		leaflet,
		place,
		onLabelUpdate
	);

	return { marker, boosted };
};
