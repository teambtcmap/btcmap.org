import type { Place, Area, User, Event, Report, ProgressUpdate } from '../types';

// Type constraint to ensure items have required properties
type ItemWithId = Area | User | Event | Report;

// Type guard to validate runtime types
function hasRequiredProperties(item: unknown): item is ItemWithId {
	return (
		typeof item === 'object' &&
		item !== null &&
		'id' in item &&
		'deleted_at' in item &&
		(typeof (item as ItemWithId).id === 'string' || typeof (item as ItemWithId).id === 'number') &&
		(typeof (item as ItemWithId).deleted_at === 'string' ||
			(item as ItemWithId).deleted_at === null)
	);
}

export interface ParseJSONPayload {
	json: string;
	type: 'places' | 'areas' | 'users' | 'events' | 'reports';
}

export interface FilterPlacesPayload {
	places: Place[];
	updatedPlaceIds: number[];
	recentUpdates: Place[];
}

export interface FilterDeletedPayload {
	items: (Place | Area | User | Event | Report)[];
	type: 'places' | 'areas' | 'users' | 'events' | 'reports';
}

export interface MergeUpdatesPayload {
	cached: ItemWithId[];
	updates: ItemWithId[];
	type: 'areas' | 'users' | 'events' | 'reports';
}

export interface WorkerMessage {
	type: 'PARSE_JSON' | 'FILTER_PLACES' | 'FILTER_DELETED' | 'MERGE_UPDATES';
	payload: ParseJSONPayload | FilterPlacesPayload | FilterDeletedPayload | MergeUpdatesPayload;
	id: string;
}

export interface WorkerResponse {
	type: 'PARSED' | 'FILTERED' | 'MERGED' | 'ERROR' | 'PROGRESS';
	payload: unknown;
	id: string;
}

function serializeError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	if (typeof error === 'object' && error !== null) {
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const { type, payload, id } = event.data;

	try {
		switch (type) {
			case 'PARSE_JSON': {
				const parsePayload = payload as ParseJSONPayload;

				// Send initial progress
				self.postMessage({
					type: 'PROGRESS',
					payload: {
						percent: 0,
						status: 'parsing'
					} as ProgressUpdate,
					id
				} as WorkerResponse);

				// Parse JSON with progress tracking
				const startTime = performance.now();
				const parsed = JSON.parse(parsePayload.json);
				const parseTime = performance.now() - startTime;

				// Send progress update after parsing
				const itemCount = Array.isArray(parsed) ? parsed.length : 0;
				self.postMessage({
					type: 'PROGRESS',
					payload: {
						percent: 100,
						itemsParsed: itemCount,
						totalItems: itemCount,
						status: 'complete'
					} as ProgressUpdate,
					id
				} as WorkerResponse);

				console.info(`Worker parsed ${itemCount} items in ${parseTime.toFixed(2)}ms`);

				self.postMessage({
					type: 'PARSED',
					payload: parsed,
					id
				} as WorkerResponse);
				break;
			}

			case 'FILTER_PLACES': {
				const filterPayload = payload as FilterPlacesPayload;

				// Send progress update
				self.postMessage({
					type: 'PROGRESS',
					payload: {
						percent: 50,
						status: 'filtering'
					} as ProgressUpdate,
					id
				} as WorkerResponse);

				const updatedIds = new Set(filterPayload.updatedPlaceIds);

				// Filter out places that will be updated
				const filtered = filterPayload.places.filter((place) => !updatedIds.has(place.id));

				// Add non-deleted updates
				const merged = [...filtered];
				filterPayload.recentUpdates.forEach((place) => {
					if (!place.deleted_at) {
						merged.push(place);
					}
				});

				// Deduplicate by ID (keep last occurrence to preserve most recent data)
				const seenIds = new Set<number>();
				const deduplicated: Place[] = [];
				for (let i = merged.length - 1; i >= 0; i--) {
					const place = merged[i];
					if (!seenIds.has(place.id)) {
						seenIds.add(place.id);
						deduplicated.push(place);
					}
				}
				deduplicated.reverse();

				self.postMessage({
					type: 'PROGRESS',
					payload: {
						percent: 100,
						itemsParsed: deduplicated.length,
						totalItems: deduplicated.length,
						status: 'complete'
					} as ProgressUpdate,
					id
				} as WorkerResponse);

				self.postMessage({
					type: 'FILTERED',
					payload: deduplicated,
					id
				} as WorkerResponse);
				break;
			}

			case 'FILTER_DELETED': {
				const filterPayload = payload as FilterDeletedPayload;
				let filtered: unknown[];

				switch (filterPayload.type) {
					case 'areas':
						filtered = (filterPayload.items as Area[]).filter(
							(area) => !area.deleted_at && area.tags?.type !== 'trash'
						);
						break;
					case 'places':
						filtered = (filterPayload.items as Place[]).filter((place) => !place.deleted_at);
						break;
					case 'users':
						filtered = (filterPayload.items as User[]).filter((user) => !user.deleted_at);
						break;
					case 'events':
						filtered = (filterPayload.items as Event[]).filter((event) => !event.deleted_at);
						break;
					case 'reports':
						filtered = (filterPayload.items as Report[]).filter((report) => !report.deleted_at);
						break;
					default:
						filtered = filterPayload.items;
				}

				self.postMessage({
					type: 'FILTERED',
					payload: filtered,
					id
				} as WorkerResponse);
				break;
			}

			case 'MERGE_UPDATES': {
				const mergePayload = payload as MergeUpdatesPayload;

				// Type-safe mapping: handle both string and number IDs
				const updatesMap = new Map<string | number, ItemWithId>();
				mergePayload.updates.forEach((item) => {
					if (hasRequiredProperties(item)) {
						updatesMap.set(item.id, item);
					}
				});

				// Filter out items that have updates
				const filtered = mergePayload.cached.filter((item) => {
					if (!hasRequiredProperties(item)) return false;
					return !updatesMap.has(item.id);
				});

				// Add non-deleted updates
				const merged = [...filtered];
				mergePayload.updates.forEach((item) => {
					if (hasRequiredProperties(item) && !item.deleted_at) {
						merged.push(item);
					}
				});

				self.postMessage({
					type: 'MERGED',
					payload: merged,
					id
				} as WorkerResponse);
				break;
			}

			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (error) {
		self.postMessage({
			type: 'ERROR',
			payload: { error: serializeError(error) },
			id
		} as WorkerResponse);
	}
};
