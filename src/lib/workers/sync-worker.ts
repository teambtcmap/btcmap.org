import type { Place, Area, User, Event, Report } from '../types';

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
	cached: (Area | User | Event | Report)[];
	updates: (Area | User | Event | Report)[];
	type: 'areas' | 'users' | 'events' | 'reports';
}

export interface WorkerMessage {
	type: 'PARSE_JSON' | 'FILTER_PLACES' | 'FILTER_DELETED' | 'MERGE_UPDATES';
	payload: ParseJSONPayload | FilterPlacesPayload | FilterDeletedPayload | MergeUpdatesPayload;
	id: string;
}

export interface WorkerResponse {
	type: 'PARSED' | 'FILTERED' | 'MERGED' | 'ERROR';
	payload: unknown;
	id: string;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const { type, payload, id } = event.data;

	try {
		switch (type) {
			case 'PARSE_JSON': {
				const parsePayload = payload as ParseJSONPayload;
				const parsed = JSON.parse(parsePayload.json);
				self.postMessage({
					type: 'PARSED',
					payload: parsed,
					id
				} as WorkerResponse);
				break;
			}

			case 'FILTER_PLACES': {
				const filterPayload = payload as FilterPlacesPayload;
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

				self.postMessage({
					type: 'FILTERED',
					payload: merged,
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
				const updatesMap = new Map(mergePayload.updates.map((item) => [item.id, item]));

				// Filter out items that have updates
				const filtered = mergePayload.cached.filter((item) => !updatesMap.has(item.id));

				// Add non-deleted updates
				const merged = [...filtered];
				mergePayload.updates.forEach((item) => {
					if (!item.deleted_at) {
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
			payload: { error: error instanceof Error ? error.message : String(error) },
			id
		} as WorkerResponse);
	}
};
