import localforage from "localforage";
import type { Writable } from "svelte/store";

import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";
import { clearTables } from "$lib/sync/clearTables";

// Base interface for syncable entities
interface SyncableEntity {
	id: string | number;
	updated_at: string;
	deleted_at?: string | null;
}

// Configuration for creating a sync function
export interface SyncConfig<T extends SyncableEntity> {
	name: string;
	storageKey: string;
	apiEndpoint: string;
	limit: number;
	store: Writable<T[]>;
	errorStore: Writable<string>;
	filterDeleted: (item: T) => boolean;
	legacyTables?: string[];
	// Server-side cache (optional, only areas uses this)
	serverCache?: {
		get: () => T[];
		set: (data: T[]) => void;
		getLastSync: () => Date | null;
	};
	cacheDuration?: number;
}

// A usable row is an object with an id. Anything else is corruption: a
// non-JSON API response (maintenance page, proxy error) parsed as a string
// gets character-iterated by the crawl loops, and the dedup collapse leaves
// exactly one stray character (typically a trailing "\n") that then survives
// every incremental merge in the persisted cache forever — crashing every
// consumer that trusts the row shape. Validate at both trust boundaries:
// API responses and cache hydration (so already-poisoned caches self-heal).
export function isSyncableRow<T extends SyncableEntity>(
	item: unknown,
): item is T {
	return (
		typeof item === "object" &&
		item !== null &&
		"id" in item &&
		(item as { id: unknown }).id != null &&
		typeof (item as { updated_at?: unknown }).updated_at === "string"
	);
}

// Factory function that creates a sync function with its own state
export function createSyncFunction<T extends SyncableEntity>(
	config: SyncConfig<T>,
): () => Promise<void> {
	// Each sync function maintains its own concurrency flag
	let syncInProgress = false;

	return async () => {
		if (syncInProgress) {
			console.info(
				`${config.name} sync already in progress, skipping concurrent invocation`,
			);
			return;
		}

		syncInProgress = true;

		try {
			const isServerSide = typeof window === "undefined";

			// Server-side cache handling (only for areas)
			if (isServerSide && config.serverCache && config.cacheDuration) {
				const cachedData = config.serverCache.get();
				const lastSync = config.serverCache.getLastSync();

				if (cachedData.length && lastSync) {
					// Use cache if still fresh
					if (Date.now() - lastSync.getTime() < config.cacheDuration) {
						config.store.set(cachedData);
						return;
					}

					// Do incremental update from expired cache
					const updatedData = await incrementalSync(
						cachedData,
						config.apiEndpoint,
						config.limit,
						config.filterDeleted,
					);
					config.store.set(updatedData);
					config.serverCache.set(updatedData);
					return;
				}
			}

			// Client-side: clear legacy storage tables
			if (!isServerSide && config.legacyTables?.length) {
				clearTables(config.legacyTables);
			}

			// Try to get cached data from local storage (client-side only)
			let cachedData: T[] | null = null;
			if (!isServerSide) {
				try {
					cachedData = await localforage.getItem(config.storageKey);
					// Persisted data is untrusted input: drop corrupt rows (or the
					// whole value if it isn't an array) so a poisoned cache heals
					// on the next sync instead of crashing consumers forever.
					cachedData = Array.isArray(cachedData)
						? cachedData.filter((item) => isSyncableRow<T>(item))
						: null;
				} catch (err) {
					console.error(`Could not load ${config.name} locally:`, err);
					config.errorStore.set(
						`Could not load ${config.name} locally, please try again or contact BTC Map.`,
					);
				}
			}

			let resultData: T[];

			if (!cachedData) {
				// Initial sync - fetch all data from API
				resultData = await initialSync(
					config.apiEndpoint,
					config.limit,
					config.filterDeleted,
					config.errorStore,
					config.name,
				);
			} else {
				// Incremental sync - update from cached data
				try {
					resultData = await incrementalSync(
						cachedData,
						config.apiEndpoint,
						config.limit,
						config.filterDeleted,
					);
				} catch (err) {
					// On error, fall back to cached data
					console.error(`Could not update ${config.name} from API:`, err);
					config.store.set(cachedData);
					return;
				}
			}

			// Save to stores
			if (resultData.length) {
				config.store.set(resultData);

				// Save to local storage (client-side)
				if (!isServerSide) {
					try {
						await localforage.setItem(config.storageKey, resultData);
					} catch (err) {
						console.error(`Could not store ${config.name} locally:`, err);
					}
				}

				// Save to server cache if configured
				if (isServerSide && config.serverCache) {
					config.serverCache.set(resultData);
				}
			}
		} catch (err) {
			console.error(`${config.name} sync failed:`, err);
			config.errorStore.set(
				`Could not sync ${config.name}, please try again or contact BTC Map.`,
			);
		} finally {
			syncInProgress = false;
		}
	};
}

// Initial sync - fetch all data from the beginning
async function initialSync<T extends SyncableEntity>(
	apiEndpoint: string,
	limit: number,
	filterDeleted: (item: T) => boolean,
	errorStore: Writable<string>,
	name: string,
): Promise<T[]> {
	let updatedSince = "2022-01-01T00:00:00.000Z";
	let responseCount: number;
	const allData: T[] = [];
	const seenIds = new Set<string | number>();

	do {
		try {
			const response = await api.get<T[]>(
				`${API_BASE}/v2/${apiEndpoint}?updated_since=${updatedSince}&limit=${limit}`,
			);

			// A non-JSON response (maintenance page, proxy error) arrives as a
			// string — iterating it would merge stray characters into the cache.
			if (!Array.isArray(response.data)) {
				throw new Error("API returned invalid data format");
			}
			// Pagination advances on the RAW count; the cursor and the merge use
			// only validated rows. Break when nothing usable remains so a
			// garbage page can't loop forever on a stuck cursor.
			responseCount = response.data.length;
			const newItems = response.data.filter((item) => isSyncableRow<T>(item));
			if (!newItems.length) break;

			updatedSince = newItems[newItems.length - 1].updated_at;

			// Add new items, avoiding duplicates
			for (const item of newItems) {
				if (!seenIds.has(item.id)) {
					seenIds.add(item.id);
					allData.push(item);
				} else {
					// Update existing item
					const idx = allData.findIndex((d) => d.id === item.id);
					if (idx !== -1) {
						allData[idx] = item;
					}
				}
			}
		} catch (error) {
			errorStore.set(
				`Could not load ${name} from API, please try again or contact BTC Map.`,
			);
			console.error(error);
			break;
		}
	} while (responseCount === limit);

	// Filter out deleted items
	return allData.filter(filterDeleted);
}

// Incremental sync - update from existing cached data
async function incrementalSync<T extends SyncableEntity>(
	cachedData: T[],
	apiEndpoint: string,
	limit: number,
	filterDeleted: (item: T) => boolean,
): Promise<T[]> {
	// Sort cache to find most recent updated_at
	const cacheSorted = [...cachedData];
	cacheSorted.sort(
		(a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at),
	);

	let updatedSince = cacheSorted[0]?.updated_at || "2022-01-01T00:00:00.000Z";
	let responseCount: number;

	// Use Map for O(1) lookups instead of array operations
	const dataMap = new Map(cachedData.map((item) => [item.id, item]));

	do {
		const response = await api.get<T[]>(
			`${API_BASE}/v2/${apiEndpoint}?updated_since=${updatedSince}&limit=${limit}`,
		);

		// Same trust-boundary rules as initialSync; a throw here propagates to
		// the caller, which falls back to the (already sanitized) cached data.
		if (!Array.isArray(response.data)) {
			throw new Error("API returned invalid data format");
		}
		responseCount = response.data.length;
		const newItems = response.data.filter((item) => isSyncableRow<T>(item));
		if (!newItems.length) break;

		updatedSince = newItems[newItems.length - 1].updated_at;

		// Update or add items
		for (const item of newItems) {
			if (filterDeleted(item)) {
				dataMap.set(item.id, item);
			} else {
				// Item was deleted, remove from cache
				dataMap.delete(item.id);
			}
		}
	} while (responseCount === limit);

	return Array.from(dataMap.values());
}
