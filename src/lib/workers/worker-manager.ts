import type {
	WorkerMessage,
	WorkerResponse,
	ProcessedPlace,
	BatchReadyPayload,
	PlacesProcessedPayload,
	ErrorPayload
} from './map-worker';
import type { Place } from '../types';

export class MapWorkerManager {
	private worker: Worker | null = null;
	private workerInitialized = false;
	private workerSupported: boolean | null = null;
	private messageId = 0;
	private pendingRequests = new Map<
		string,
		{
			resolve: (value: unknown) => void;
			reject: (error: unknown) => void;
			onProgress?: (progress: number, batch?: ProcessedPlace[]) => void;
		}
	>();

	constructor() {
		// Don't initialize worker immediately - use lazy initialization
	}

	private isWorkerSupported(): boolean {
		if (this.workerSupported !== null) {
			return this.workerSupported;
		}

		// Feature detection for Web Workers
		this.workerSupported =
			typeof Worker !== 'undefined' && typeof window !== 'undefined' && 'Worker' in window;

		return this.workerSupported;
	}

	private async initWorker(): Promise<boolean> {
		if (this.workerInitialized) {
			return this.worker !== null;
		}

		this.workerInitialized = true;

		if (!this.isWorkerSupported()) {
			console.warn('Web Workers not supported, falling back to synchronous processing');
			return false;
		}

		try {
			this.worker = new Worker(new URL('./map-worker.ts', import.meta.url), {
				type: 'module'
			});

			this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
				this.handleWorkerMessage(event.data);
			};

			this.worker.onerror = (error) => {
				console.error('Map worker error:', error);
				// Don't terminate on error, let individual operations handle fallback
			};

			return true;
		} catch (error) {
			console.warn('Failed to initialize web worker:', error);
			this.worker = null;
			return false;
		}
	}

	private handleWorkerMessage(response: WorkerResponse) {
		const request = this.pendingRequests.get(response.id);
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
				this.pendingRequests.delete(response.id);
				break;
			}

			case 'ICONS_GENERATED': {
				const iconsPayload = response.payload as unknown[];
				request.resolve(iconsPayload);
				this.pendingRequests.delete(response.id);
				break;
			}

			case 'ERROR': {
				const errorPayload = response.payload as ErrorPayload;
				request.reject(new Error(errorPayload.error));
				this.pendingRequests.delete(response.id);
				break;
			}
		}
	}

	private generateMessageId(): string {
		return `msg_${++this.messageId}_${Date.now()}`;
	}

	/**
	 * Process places in batches using web worker
	 */
	async processPlaces(
		places: Place[],
		batchSize: number = 50,
		onProgress?: (progress: number, batch?: ProcessedPlace[]) => void
	): Promise<PlacesProcessedPayload> {
		// Lazy initialization
		const workerReady = await this.initWorker();

		if (!workerReady || !this.worker) {
			throw new Error('Web Worker not supported or failed to initialize');
		}

		const id = this.generateMessageId();

		return new Promise<PlacesProcessedPayload>((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject,
				onProgress
			});

			const message: WorkerMessage = {
				type: 'PROCESS_PLACES',
				payload: { places, batchSize },
				id
			};

			this.worker!.postMessage(message);
		});
	}

	/**
	 * Generate icon data for places
	 */
	async generateIconData(places: Place[]): Promise<unknown[]> {
		// Lazy initialization
		const workerReady = await this.initWorker();

		if (!workerReady || !this.worker) {
			throw new Error('Web Worker not supported or failed to initialize');
		}

		const id = this.generateMessageId();

		return new Promise<unknown[]>((resolve, reject) => {
			this.pendingRequests.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject
			});

			const message: WorkerMessage = {
				type: 'GENERATE_ICONS',
				payload: { places },
				id
			};

			this.worker!.postMessage(message);
		});
	}

	/**
	 * Check if web workers are supported without initializing
	 */
	isSupported(): boolean {
		return this.isWorkerSupported();
	}

	/**
	 * Terminate the worker
	 */
	terminate() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
		this.pendingRequests.clear();
	}
}

// Singleton instance
export const mapWorkerManager = new MapWorkerManager();
