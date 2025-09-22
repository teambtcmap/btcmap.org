import type {
	WorkerMessage,
	WorkerResponse,
	ProcessedPlace,
	BatchReadyPayload,
	PlacesProcessedPayload,
	ErrorPayload
} from './map-worker';
import type { Place } from '../types';

// Worker state - using module-level variables instead of class properties
let worker: Worker | null = null;
let workerInitialized = false;
let workerSupported: boolean | null = null;
let messageId = 0;
const pendingRequests = new Map<
	string,
	{
		resolve: (value: unknown) => void;
		reject: (error: unknown) => void;
		onProgress?: (progress: number, batch?: ProcessedPlace[]) => void;
	}
>();

// Feature detection for Web Workers
function isWorkerSupported(): boolean {
	if (workerSupported !== null) {
		return workerSupported;
	}

	workerSupported =
		typeof Worker !== 'undefined' && typeof window !== 'undefined' && 'Worker' in window;

	return workerSupported;
}

// Handle worker messages
function handleWorkerMessage(response: WorkerResponse) {
	const request = pendingRequests.get(response.id);
	if (!request) return;

	switch (response.type) {
		case 'BATCH_READY': {
			const batchPayload = response.payload as BatchReadyPayload;
			// Call progress callback with batch data
			if (request.onProgress) {
				request.onProgress(batchPayload.progress, batchPayload.batch);
			}
			break;
		}

		case 'PLACES_PROCESSED': {
			const processedPayload = response.payload as PlacesProcessedPayload;
			request.resolve(processedPayload);
			pendingRequests.delete(response.id);
			break;
		}

		case 'ICONS_GENERATED': {
			const iconsPayload = response.payload as unknown[];
			request.resolve(iconsPayload);
			pendingRequests.delete(response.id);
			break;
		}

		case 'ERROR': {
			const errorPayload = response.payload as ErrorPayload;
			request.reject(new Error(errorPayload.error));
			pendingRequests.delete(response.id);
			break;
		}
	}
}

// Initialize worker lazily
async function initWorker(): Promise<boolean> {
	if (workerInitialized) {
		return worker !== null;
	}

	workerInitialized = true;

	if (!isWorkerSupported()) {
		console.warn('Web Workers not supported, falling back to synchronous processing');
		return false;
	}

	try {
		worker = new Worker(new URL('./map-worker.ts', import.meta.url), {
			type: 'module'
		});

		worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			handleWorkerMessage(event.data);
		};

		worker.onerror = (error) => {
			console.error('Map worker error:', error);
			// Don't terminate on error, let individual operations handle fallback
		};

		return true;
	} catch (error) {
		console.warn('Failed to initialize web worker:', error);
		worker = null;
		return false;
	}
}

// Generate unique message ID
function generateMessageId(): string {
	return `msg_${++messageId}_${Date.now()}`;
}

/**
 * Process places in batches using web worker
 */
export async function processPlaces(
	places: Place[],
	batchSize: number = 50,
	onProgress?: (progress: number, batch?: ProcessedPlace[]) => void
): Promise<PlacesProcessedPayload> {
	// Lazy initialization
	const workerReady = await initWorker();

	if (!workerReady || !worker) {
		throw new Error('Web Worker not supported or failed to initialize');
	}

	const id = generateMessageId();

	return new Promise<PlacesProcessedPayload>((resolve, reject) => {
		pendingRequests.set(id, {
			resolve: resolve as (value: unknown) => void,
			reject,
			onProgress
		});

		const message: WorkerMessage = {
			type: 'PROCESS_PLACES',
			payload: { places, batchSize },
			id
		};

		worker!.postMessage(message);
	});
}

/**
 * Generate icon data for places
 */
export async function generateIconData(places: Place[]): Promise<unknown[]> {
	// Lazy initialization
	const workerReady = await initWorker();

	if (!workerReady || !worker) {
		throw new Error('Web Worker not supported or failed to initialize');
	}

	const id = generateMessageId();

	return new Promise<unknown[]>((resolve, reject) => {
		pendingRequests.set(id, {
			resolve: resolve as (value: unknown) => void,
			reject
		});

		const message: WorkerMessage = {
			type: 'GENERATE_ICONS',
			payload: { places },
			id
		};

		worker!.postMessage(message);
	});
}

/**
 * Check if web workers are supported without initializing
 */
export function isSupported(): boolean {
	return isWorkerSupported();
}

/**
 * Terminate the worker and cleanup
 */
export function terminate() {
	if (worker) {
		worker.terminate();
		worker = null;
	}
	pendingRequests.clear();
	workerInitialized = false;
}
