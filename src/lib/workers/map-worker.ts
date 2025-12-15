import type { Place } from "../types";

export interface ProcessPlacesPayload {
	places: Place[];
	batchSize: number;
}

export interface GenerateIconsPayload {
	places: Place[];
}

export interface BatchReadyPayload {
	batch: ProcessedPlace[];
	batchIndex: number;
	totalBatches: number;
	progress: number;
}

export interface PlacesProcessedPayload {
	totalProcessed: number;
}

export interface ErrorPayload {
	error: string;
}

export interface WorkerMessage {
	type: "PROCESS_PLACES" | "GENERATE_ICONS";
	payload: ProcessPlacesPayload | GenerateIconsPayload;
	id: string;
}

export interface WorkerResponse {
	type: "PLACES_PROCESSED" | "ICONS_GENERATED" | "BATCH_READY" | "ERROR";
	payload:
		| PlacesProcessedPayload
		| BatchReadyPayload
		| ErrorPayload
		| unknown[];
	id: string;
}

export interface ProcessedPlace extends Place {
	iconData: {
		className: string;
		iconTmp: string;
		commentsCount: number;
		boosted: boolean;
	};
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
	const { type, payload, id } = event.data;

	try {
		switch (type) {
			case "PROCESS_PLACES": {
				const processPayload = payload as ProcessPlacesPayload;
				processPlacesInBatches(
					processPayload.places,
					processPayload.batchSize,
					id,
				);
				break;
			}
			case "GENERATE_ICONS": {
				const iconPayload = payload as GenerateIconsPayload;
				generateIconData(iconPayload.places, id);
				break;
			}
			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (error) {
		self.postMessage({
			type: "ERROR",
			payload: {
				error: error instanceof Error ? error.message : String(error),
			} as ErrorPayload,
			id,
		} as WorkerResponse);
	}
};

// Utility function to yield control back to the event loop
// Uses MessageChannel for reliable yielding without setTimeout delays
function yieldToEventLoop(): Promise<void> {
	// Use MessageChannel for immediate, reliable yielding
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port2.onmessage = () => resolve();
		channel.port1.postMessage(null);
	});
}

// Extract common icon data calculation logic
function calculateIconData(place: Place) {
	const isBoosted = place.boosted_until
		? Date.parse(place.boosted_until) > Date.now()
		: false;

	return {
		className: isBoosted ? "animate-wiggle" : "",
		iconTmp: place.icon !== "question_mark" ? place.icon : "currency_bitcoin",
		commentsCount: place.comments || 0,
		boosted: isBoosted,
	};
}

// Process places in batches to avoid blocking
async function processPlacesInBatches(
	places: Place[],
	batchSize: number = 50,
	requestId: string,
) {
	const totalBatches = Math.ceil(places.length / batchSize);

	for (let i = 0; i < totalBatches; i++) {
		const start = i * batchSize;
		const end = Math.min(start + batchSize, places.length);
		const batch = places.slice(start, end);

		// Process batch
		const processedBatch: ProcessedPlace[] = batch.map((place) => ({
			...place,
			iconData: calculateIconData(place),
		}));

		// Send batch back to main thread
		self.postMessage({
			type: "BATCH_READY",
			payload: {
				batch: processedBatch,
				batchIndex: i,
				totalBatches,
				progress: ((i + 1) / totalBatches) * 100,
			},
			id: requestId,
		} as WorkerResponse);

		// Yield control to prevent worker blocking - use proper scheduler
		await yieldToEventLoop();
	}

	// Signal completion
	self.postMessage({
		type: "PLACES_PROCESSED",
		payload: { totalProcessed: places.length } as PlacesProcessedPayload,
		id: requestId,
	} as WorkerResponse);
}

function generateIconData(places: Place[], requestId: string) {
	// Pre-calculate icon data without DOM manipulation
	const iconData = places.map((place) => ({
		id: place.id,
		iconData: calculateIconData(place),
	}));

	self.postMessage({
		type: "ICONS_GENERATED",
		payload: iconData,
		id: requestId,
	} as WorkerResponse);
}
