import type { Marker, TooltipOptions } from "leaflet";

import { LABEL_VISIBLE_ZOOM } from "$lib/constants";
import { getDisplayLang } from "$lib/i18n";
import type { LoadedMarkers } from "$lib/map/markers";
import type { Leaflet, Place } from "$lib/types";
import { escapeHtml } from "$lib/utils";

/**
 * Marker label management for the map
 * Handles tooltip creation, updates, and visibility based on zoom level
 */

/**
 * Shared tooltip configuration to avoid duplication across functions
 */
export function getMarkerLabelTooltipOptions(
	leaflet: Leaflet,
	boosted: boolean = false,
): TooltipOptions {
	return {
		permanent: true,
		direction: "right",
		className: boosted ? "marker-label marker-label-boosted" : "marker-label",
		// Position label to the right of marker (17px) and above center (-25px)
		// to avoid overlapping with the marker icon tip
		offset: leaflet.point(17, -25),
	};
}

/**
 * Check if a place is currently boosted
 */
export function isPlaceBoosted(place?: Place | null): boolean {
	return place?.boosted_until
		? Date.parse(place.boosted_until) > Date.now()
		: false;
}

/**
 * Centralized handler for binding tooltips to markers
 * Only updates tooltip if content or styling has changed
 */
export function bindMarkerLabelTooltip(
	marker: Marker,
	labelText: string,
	boosted: boolean,
	leaflet: Leaflet,
): void {
	const tooltip = marker.getTooltip();
	if (tooltip) {
		const options = getMarkerLabelTooltipOptions(leaflet, boosted);
		const currentClass = tooltip.options.className || "";
		const needsClassUpdate = currentClass !== options.className;
		const needsContentUpdate = tooltip.getContent() !== labelText;

		// No changes needed
		if (!needsClassUpdate && !needsContentUpdate) {
			return;
		}

		// If class needs to change, recreate the tooltip using Leaflet's public API
		// (Leaflet doesn't provide a way to update tooltip classes after creation)
		if (needsClassUpdate) {
			marker.unbindTooltip();
			marker.bindTooltip(labelText, options);
			return;
		}

		// Only content needs updating - setContent() automatically updates the DOM
		if (needsContentUpdate) {
			tooltip.setContent(labelText);
		}
		return;
	}
	marker.bindTooltip(labelText, getMarkerLabelTooltipOptions(leaflet, boosted));
}

/**
 * Get label text for a place from multiple sources (with fallback chain)
 */
export function getLabelText(
	placeId: number,
	placeDetailsCache: Map<number, Place>,
	placesById: Map<number, Place>,
	fallbackPlace?: Place,
	locale?: string | null,
): string | null {
	const lang = getDisplayLang(locale);
	const sources: Array<Place | undefined> = [
		placeDetailsCache.get(placeId),
		fallbackPlace,
		placesById.get(placeId),
	];

	for (const source of sources) {
		if (!source) continue;
		// Handle empty string as intentional "no name" to prevent fallback
		if (source.name === "") return null;
		// Check for localized name first, then fall back to default name
		if (source.localized_name?.[lang]) {
			return escapeHtml(source.localized_name[lang]);
		}
		if (source.name) return escapeHtml(source.name);
		if (source["osm:amenity"]) return escapeHtml(source["osm:amenity"]);
	}

	return null;
}

/**
 * Attach label tooltip to marker if zoom level allows visibility
 */
export function attachMarkerLabelIfVisible(
	marker: Marker,
	placeId: number,
	currentZoom: number,
	placeDetailsCache: Map<number, Place>,
	placesById: Map<number, Place>,
	boosted: boolean,
	leaflet: Leaflet,
	fallbackPlace?: Place,
	signalUpdate?: () => void,
	locale?: string | null,
): boolean {
	if (currentZoom < LABEL_VISIBLE_ZOOM) return false;

	const labelText = getLabelText(
		placeId,
		placeDetailsCache,
		placesById,
		fallbackPlace,
		locale,
	);
	if (labelText) {
		bindMarkerLabelTooltip(marker, labelText, boosted, leaflet);
		if (signalUpdate) {
			signalUpdate();
		}
		return true;
	}
	return false;
}

/**
 * Update all marker labels based on zoom level and available data
 */
export function updateMarkerLabels(
	loadedMarkers: LoadedMarkers,
	currentZoom: number,
	placeDetailsCache: Map<number, Place>,
	placesById: Map<number, Place>,
	boostedLayerMarkerIds: Set<string>,
	leaflet: Leaflet,
	locale?: string | null,
): void {
	if (currentZoom < LABEL_VISIBLE_ZOOM) {
		// Remove all tooltips when zoomed out
		Object.values(loadedMarkers).forEach((marker) => {
			if (marker.getTooltip()) {
				marker.unbindTooltip();
			}
		});
		return;
	}

	// Update or create tooltips for all visible markers
	Object.entries(loadedMarkers).forEach(([placeId, marker]) => {
		const placeIdNum = Number(placeId);
		const sourcePlace = placesById.get(placeIdNum);
		const boosted =
			isPlaceBoosted(sourcePlace) || boostedLayerMarkerIds.has(placeId);

		const attached = attachMarkerLabelIfVisible(
			marker,
			placeIdNum,
			currentZoom,
			placeDetailsCache,
			placesById,
			boosted,
			leaflet,
			sourcePlace,
			undefined,
			locale,
		);

		// Clean up stale tooltips if label text is no longer available
		if (!attached && marker.getTooltip()) {
			marker.unbindTooltip();
		}
	});
}

/**
 * State tracker for label updates
 * Manages change detection to trigger label updates efficiently
 */
export class LabelUpdateTracker {
	private lastLabelZoomState: boolean;
	private lastCacheRevision: number;
	private lastEnrichingState: boolean;
	private lastLocale: string;
	private labelVersion: number = 0;
	private lastLabelVersion: number = 0;

	constructor(
		initialZoom: number,
		initialCacheSize: number,
		initialEnrichingState: boolean,
		initialLocale?: string | null,
	) {
		this.lastLabelZoomState = initialZoom >= LABEL_VISIBLE_ZOOM;
		this.lastCacheRevision = initialCacheSize;
		this.lastEnrichingState = initialEnrichingState;
		this.lastLocale = getDisplayLang(initialLocale);
	}

	/**
	 * Signal that a label was manually updated (e.g., marker was just added)
	 */
	public incrementVersion(): void {
		this.labelVersion += 1;
	}

	/**
	 * Determines if marker labels need updating based on state changes
	 * Returns true if update is needed
	 */
	public shouldUpdate(
		labelsVisible: boolean,
		currentCacheSize: number,
		isEnriching: boolean,
		currentLocale: string | null | undefined,
		updateCallback: () => void,
	): boolean {
		const normalizedLocale = getDisplayLang(currentLocale);
		const zoomStateChanged = labelsVisible !== this.lastLabelZoomState;
		const cacheChanged = currentCacheSize !== this.lastCacheRevision;
		const enrichmentCompleted = this.lastEnrichingState && !isEnriching;
		const versionChanged = this.labelVersion !== this.lastLabelVersion;
		const localeChanged = normalizedLocale !== this.lastLocale;

		const shouldUpdate =
			zoomStateChanged ||
			cacheChanged ||
			enrichmentCompleted ||
			versionChanged ||
			localeChanged;

		if (shouldUpdate) {
			updateCallback();
			this.lastLabelZoomState = labelsVisible;
			this.lastCacheRevision = currentCacheSize;
			this.lastLabelVersion = this.labelVersion;
			this.lastLocale = normalizedLocale;
		}

		this.lastEnrichingState = isEnriching;
		return shouldUpdate;
	}
}
