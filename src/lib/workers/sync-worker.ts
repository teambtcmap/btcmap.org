import type { Place, ProgressUpdate } from "../types";

export type ParseJSONPayload = {
	json: string;
	type: "places" | "areas" | "users" | "events" | "reports";
};

export type FilterPlacesPayload = {
	places: Place[];
	updatedPlaceIds: number[];
	recentUpdates: Place[];
};

export type WorkerMessage = {
	type: "PARSE_JSON" | "FILTER_PLACES";
	payload: ParseJSONPayload | FilterPlacesPayload;
	id: string;
};

export type WorkerResponse = {
	type: "PARSED" | "FILTERED" | "ERROR" | "PROGRESS";
	payload: unknown;
	id: string;
};

function serializeError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	if (typeof error === "object" && error !== null) {
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
			case "PARSE_JSON": {
				const parsePayload = payload as ParseJSONPayload;

				// Send initial progress
				self.postMessage({
					type: "PROGRESS",
					payload: {
						percent: 0,
						status: "parsing",
					} as ProgressUpdate,
					id,
				} as WorkerResponse);

				// Parse JSON with progress tracking
				const startTime = performance.now();
				const parsed = JSON.parse(parsePayload.json);
				const parseTime = performance.now() - startTime;

				// Send progress update after parsing
				const itemCount = Array.isArray(parsed) ? parsed.length : 0;
				self.postMessage({
					type: "PROGRESS",
					payload: {
						percent: 100,
						itemsParsed: itemCount,
						totalItems: itemCount,
						status: "complete",
					} as ProgressUpdate,
					id,
				} as WorkerResponse);

				console.info(
					`Worker parsed ${itemCount} items in ${parseTime.toFixed(2)}ms`,
				);

				self.postMessage({
					type: "PARSED",
					payload: parsed,
					id,
				} as WorkerResponse);
				break;
			}

			case "FILTER_PLACES": {
				const filterPayload = payload as FilterPlacesPayload;

				// Send progress update
				self.postMessage({
					type: "PROGRESS",
					payload: {
						percent: 50,
						status: "filtering",
					} as ProgressUpdate,
					id,
				} as WorkerResponse);

				const updatedIds = new Set(filterPayload.updatedPlaceIds);

				// Filter out places that will be updated
				const filtered = filterPayload.places.filter(
					(place) => !updatedIds.has(place.id),
				);

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
					type: "PROGRESS",
					payload: {
						percent: 100,
						itemsParsed: deduplicated.length,
						totalItems: deduplicated.length,
						status: "complete",
					} as ProgressUpdate,
					id,
				} as WorkerResponse);

				self.postMessage({
					type: "FILTERED",
					payload: deduplicated,
					id,
				} as WorkerResponse);
				break;
			}

			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (error) {
		self.postMessage({
			type: "ERROR",
			payload: { error: serializeError(error) },
			id,
		} as WorkerResponse);
	}
};
