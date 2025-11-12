import type { WorkerMessage, WorkerResponse } from './sync-worker';
import type { Place, Area, User, Event, Report } from '../types';

let worker: Worker | null = null;
let workerInitialized = false;
let workerSupported: boolean | null = null;
let messageId = 0;
const pendingRequests = new Map<
	string,
	{
		resolve: (value: unknown) => void;
		reject: (error: unknown) => void;
	}
>();

function isWorkerSupported(): boolean {
	if (workerSupported !== null) {
		return workerSupported;
	}

	workerSupported =
		typeof Worker !== 'undefined' && typeof window !== 'undefined' && 'Worker' in window;

	return workerSupported;
}

function handleWorkerMessage(response: WorkerResponse) {
	const request = pendingRequests.get(response.id);
	if (!request) return;

	switch (response.type) {
		case 'PARSED':
		case 'FILTERED':
		case 'MERGED':
			request.resolve(response.payload);
			pendingRequests.delete(response.id);
			break;

		case 'ERROR':
			request.reject(new Error(String(response.payload)));
			pendingRequests.delete(response.id);
			break;
	}
}

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
		worker = new Worker(new URL('./sync-worker.ts', import.meta.url), {
			type: 'module'
		});

		worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			handleWorkerMessage(event.data);
		};

		worker.onerror = (error) => {
			console.error('Sync worker error:', error);
		};

		return true;
	} catch (error) {
		console.warn('Failed to initialize sync worker:', error);
		worker = null;
		return false;
	}
}

function generateMessageId(): string {
	return `sync_msg_${++messageId}_${Date.now()}`;
}

async function sendWorkerMessage<T>(
	messageType: WorkerMessage['type'],
	payload: WorkerMessage['payload']
): Promise<T> {
	const workerReady = await initWorker();

	if (!workerReady || !worker) {
		// Fallback to synchronous processing
		throw new Error('Web Worker not supported');
	}

	const id = generateMessageId();

	return new Promise<T>((resolve, reject) => {
		if (!worker) {
			reject(new Error('Worker became unavailable'));
			return;
		}

		pendingRequests.set(id, {
			resolve: resolve as (value: unknown) => void,
			reject
		});

		const message: WorkerMessage = {
			type: messageType,
			payload,
			id
		};

		worker.postMessage(message);
	});
}

export async function parseJSON<T>(
	json: string,
	type: 'places' | 'areas' | 'users' | 'events' | 'reports'
): Promise<T> {
	try {
		return await sendWorkerMessage<T>('PARSE_JSON', { json, type });
	} catch (error) {
		// Fallback to synchronous parsing
		console.warn('Worker parsing failed, using synchronous fallback');
		return JSON.parse(json);
	}
}

export async function filterPlaces(
	places: Place[],
	updatedPlaceIds: number[],
	recentUpdates: Place[]
): Promise<Place[]> {
	try {
		return await sendWorkerMessage<Place[]>('FILTER_PLACES', {
			places,
			updatedPlaceIds,
			recentUpdates
		});
	} catch (error) {
		// Fallback to synchronous filtering
		console.warn('Worker filtering failed, using synchronous fallback');
		const updatedIds = new Set(updatedPlaceIds);
		const filtered = places.filter((place) => !updatedIds.has(place.id));
		const merged = [...filtered];
		recentUpdates.forEach((place) => {
			if (!place.deleted_at) {
				merged.push(place);
			}
		});
		return merged;
	}
}

export async function filterDeleted<T extends Place | Area | User | Event | Report>(
	items: T[],
	type: 'places' | 'areas' | 'users' | 'events' | 'reports'
): Promise<T[]> {
	try {
		return await sendWorkerMessage<T[]>('FILTER_DELETED', { items, type });
	} catch (error) {
		// Fallback to synchronous filtering
		console.warn('Worker filtering failed, using synchronous fallback');
		return items.filter((item: any) => !item.deleted_at);
	}
}

export async function mergeUpdates<T extends Area | User | Event | Report>(
	cached: T[],
	updates: T[],
	type: 'areas' | 'users' | 'events' | 'reports'
): Promise<T[]> {
	try {
		return await sendWorkerMessage<T[]>('MERGE_UPDATES', { cached, updates, type });
	} catch (error) {
		// Fallback to synchronous merging
		console.warn('Worker merging failed, using synchronous fallback');
		const updatesMap = new Map(updates.map((item: any) => [item.id, item]));
		const filtered = cached.filter((item: any) => !updatesMap.has(item.id));
		const merged = [...filtered];
		updates.forEach((item: any) => {
			if (!item.deleted_at) {
				merged.push(item);
			}
		});
		return merged;
	}
}

export function terminate() {
	if (worker) {
		worker.terminate();
		worker = null;
	}
	pendingRequests.clear();
	workerInitialized = false;
}
