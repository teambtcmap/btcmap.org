import { BOOSTED_CLUSTERING_MAX_ZOOM } from "$lib/constants";
import type { Place } from "$lib/types";
import { isBoosted } from "$lib/utils";

// The legacy Leaflet /map clustered boosted (orange) markers together with
// regular ones at world/continent zoom and only pulled them out into a
// standalone, non-clustered layer once zoomed past BOOSTED_CLUSTERING_MAX_ZOOM
// — otherwise the zoomed-out view is littered with overlapping orange pins.
// MapLibre's `cluster` flag is a static per-source property, so we reproduce
// that zoom gate by routing boosted places into the clustered source at/below
// the threshold and into the non-clustered source above it.
export const shouldClusterBoostedAtZoom = (zoom: number): boolean =>
	zoom <= BOOSTED_CLUSTERING_MAX_ZOOM;

export type BoostedPlaceRouting = {
	// → the cluster:true "places" source
	clustered: Place[];
	// → the cluster:false "places-boosted" source
	standalone: Place[];
};

// Split places into the two MapLibre sources, dropping deleted ones. Above the
// zoom threshold boosted places ride the standalone source so a paid boost
// always stands out above cluster discs; at/below it they fold into the
// clustered source so the zoomed-out view stays uncluttered.
export const routePlacesByBoostAndZoom = (
	places: Place[],
	zoom: number,
): BoostedPlaceRouting => {
	const clusterBoosted = shouldClusterBoostedAtZoom(zoom);
	const clustered: Place[] = [];
	const standalone: Place[] = [];
	for (const place of places) {
		if (place.deleted_at) continue;
		if (isBoosted(place) && !clusterBoosted) standalone.push(place);
		else clustered.push(place);
	}
	return { clustered, standalone };
};
