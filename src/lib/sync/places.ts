import type { AxiosProgressEvent } from "axios";
import { get } from "svelte/store";

import { API_BASE } from "$lib/api-base";
import {
	buildFieldsParam,
	PLACE_FIELD_SETS,
	PLACE_FIELDS,
} from "$lib/api-fields";
import api from "$lib/axios";
import {
	completePlaceUrl,
	evictPlaceDetails,
	primePlaceDetails,
} from "$lib/placeDetails";
import {
	mapUpdates,
	paymentDataLoaded,
	places,
	placesError,
	placesLoadingProgress,
	placesLoadingStatus,
	placesSyncCount,
	verifiedDatesLoaded,
} from "$lib/store";
import { clearTables } from "$lib/sync/clearTables";
import {
	publishPlaces,
	readPlaceCache,
	readPlacesSyncedAt,
	writePlacesSyncedAt,
} from "$lib/sync/placeCache";
import type { Place } from "$lib/types";
import { filterPlaces, parseJSON } from "$lib/workers/sync-worker-manager";

// Concurrency protection to prevent multiple simultaneous syncs
let syncInProgress = false;

// Maximum age for cached sync timestamp (in days)
const MAX_CACHE_AGE_DAYS = 90;

// Progress range constants for clear progress mapping
const PROGRESS_RANGES = {
	DOWNLOAD_START: 10,
	DOWNLOAD_END: 50,
	PARSE_START: 50,
	PARSE_END: 80,
	CACHE_LOAD: 60,
	UPDATE_CHECK: 70,
	UPDATE_CHECK_NO_CACHE: 85,
	MERGE_START: 80,
	MERGE_START_NO_CACHE: 90,
	FINALIZE: 95,
	COMPLETE: 100,
} as const;

// Helper function to get date 2 weeks ago (fallback)
const getTwoWeeksAgoDate = (): string => {
	const twoWeeksAgo = new Date();
	twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
	return twoWeeksAgo.toISOString();
};

// Helper function to validate sync dates (not in future, not older than MAX_CACHE_AGE_DAYS)
const isValidSyncDate = (dateStr: string): boolean => {
	const date = new Date(dateStr);
	const now = new Date();
	const maxAgeDate = new Date();
	maxAgeDate.setDate(maxAgeDate.getDate() - MAX_CACHE_AGE_DAYS);
	return date <= now && date >= maxAgeDate;
};

// Helper function to get static file's last modified date
const getStaticFileDate = async (): Promise<string> => {
	try {
		// Use HEAD request to get headers without downloading the full file
		const headResponse = await api.head(
			"https://cdn.static.btcmap.org/api/v4/places.json",
		);
		const lastModified = headResponse.headers["last-modified"];

		if (lastModified) {
			const staticDateStr = new Date(lastModified).toISOString();

			if (isValidSyncDate(staticDateStr)) {
				console.info(`Using static file date for updates: ${staticDateStr}`);
				return staticDateStr;
			} else {
				console.warn(
					`Static file date invalid (${staticDateStr}), using fallback`,
				);
			}
		}
	} catch (error) {
		console.warn("Failed to get static file date, using fallback:", error);
	}

	// Fallback to 2 weeks ago
	return getTwoWeeksAgoDate();
};

// Serializes the $places enrichment merges (verified dates, payment tags).
// Each enricher reads the whole array, rebuilds it, and republishes; two
// running concurrently — a combo deep link like ?issues&lightning dispatches
// both in one reactive flush — would build from the same snapshot and the
// later places.set would silently erase the earlier merge, with its
// readiness flag already latched (hiding pins for the rest of the session).
// Fetches stay concurrent; only the read→merge→publish window is exclusive.
// The chain itself never rejects — each section's errors belong to its
// caller.
let enrichmentChain: Promise<unknown> = Promise.resolve();
const withEnrichmentLock = <T>(section: () => Promise<T>): Promise<T> => {
	const run = enrichmentChain.then(section);
	enrichmentChain = run.catch(() => undefined);
	return run;
};

// The bulk CDN feed (places.json) carries no verification date, so a place's
// baseline date is unknown until this runs. Fetch verified_at for every place
// in one lean call and merge it into $places by id. Fetched LAZILY — only when
// the recency filter is engaged (default users never call this) and once per
// session (the flag is in-memory, so a new session re-fetches the full set —
// keeping the baseline fresh). Incremental MAP_SYNC updates carry verified_at,
// so changed places stay fresh within the session too. Sets
// verifiedDatesLoaded so the filter flips from inert to active. Best-effort:
// on failure the flag stays false and the filter keeps showing everything.
export const ensureVerifiedDates = async (): Promise<void> => {
	if (get(verifiedDatesLoaded)) return;
	try {
		const response = await api.get<{ id: number; verified_at?: string }[]>(
			`${API_BASE}/v4/places?fields=id,verified_at`,
		);
		if (!Array.isArray(response.data)) return;
		const verifiedById = new Map<number, string>();
		for (const item of response.data) {
			if (typeof item?.id === "number" && item.verified_at) {
				verifiedById.set(item.id, item.verified_at);
			}
		}
		// Only latch the flag once we actually have dates. An empty/degenerate
		// response (e.g. an API hiccup returning []) must NOT flip the gate true,
		// or the filter would hide every pin with no dates to match. Leaving the
		// flag false keeps the filter inert (shows everything) and lets a later
		// sync retry.
		if (verifiedById.size === 0) return;
		await withEnrichmentLock(async () => {
			// Re-check under the lock: a concurrent caller may have latched
			// while this one waited.
			if (get(verifiedDatesLoaded)) return;
			const current = get(places);
			// If the bulk places haven't loaded yet (the dates fetch won the race),
			// bail without latching or caching — otherwise we'd persist an empty
			// places_v4 and flip the gate true with no data, hiding everything. The
			// caller re-runs once $places is populated.
			if (current.length === 0) return;
			const enriched = current.map((p) => {
				const verified_at = verifiedById.get(p.id);
				return verified_at && verified_at !== p.verified_at
					? { ...p, verified_at }
					: p;
			});
			// Always publishes (persistence is best-effort inside placeCache), so
			// the enrichment survives a failed blob write — matching the old
			// publish-first ordering this replaced.
			await publishPlaces(enriched);
			verifiedDatesLoaded.set(true);
		});
	} catch (error) {
		console.warn("Could not load verification dates:", error);
	}
};

// The bulk feed (MAP_SYNC) carries no payment-method tags, so the embed
// payment filter (?onchain&lightning&nfc — see $lib/map/paymentFilter) has
// nothing to match until this runs. Fetch the three tags for every place in
// one lean call and merge them into $places by id. Fetched LAZILY — only
// when a payment deep link is present (normal visitors never call this) and
// once per session. Sets paymentDataLoaded so the filter flips from inert to
// active. Best-effort: on failure the flag stays false and the filter keeps
// showing everything.
type PaymentTagsRow = Pick<
	Place,
	| "id"
	| "osm:payment:onchain"
	| "osm:payment:lightning"
	| "osm:payment:lightning_contactless"
>;

export const ensurePaymentMethods = async (): Promise<void> => {
	if (get(paymentDataLoaded)) return;
	try {
		const response = await api.get<PaymentTagsRow[]>(
			`${API_BASE}/v4/places?fields=id,${buildFieldsParam(PLACE_FIELDS.PAYMENT_METHOD)}`,
		);
		if (!Array.isArray(response.data)) return;
		const paymentById = new Map<number, PaymentTagsRow>();
		for (const item of response.data) {
			if (
				typeof item?.id === "number" &&
				(item["osm:payment:onchain"] !== undefined ||
					item["osm:payment:lightning"] !== undefined ||
					item["osm:payment:lightning_contactless"] !== undefined)
			) {
				paymentById.set(item.id, item);
			}
		}
		// Same latch guard as ensureVerifiedDates: an empty/degenerate response
		// must NOT flip the gate true, or the filter would hide every pin with
		// no tags to match. Leaving the flag false keeps the filter inert
		// (shows everything) and lets a later call retry.
		if (paymentById.size === 0) return;
		await withEnrichmentLock(async () => {
			// Re-check under the lock: a concurrent caller may have latched
			// while this one waited.
			if (get(paymentDataLoaded)) return;
			const current = get(places);
			// If the bulk places haven't loaded yet (the tags fetch won the race),
			// bail without latching or caching — the caller re-runs once $places
			// is populated.
			if (current.length === 0) return;
			const enriched = current.map((p) => {
				const row = paymentById.get(p.id);
				if (
					!row ||
					(row["osm:payment:onchain"] === p["osm:payment:onchain"] &&
						row["osm:payment:lightning"] === p["osm:payment:lightning"] &&
						row["osm:payment:lightning_contactless"] ===
							p["osm:payment:lightning_contactless"])
				) {
					return p;
				}
				return {
					...p,
					"osm:payment:onchain": row["osm:payment:onchain"],
					"osm:payment:lightning": row["osm:payment:lightning"],
					"osm:payment:lightning_contactless":
						row["osm:payment:lightning_contactless"],
				};
			});
			// Always publishes (persistence is best-effort inside placeCache), so
			// the enrichment survives a failed blob write.
			await publishPlaces(enriched);
			paymentDataLoaded.set(true);
		});
	} catch (error) {
		console.warn("Could not load payment methods:", error);
	}
};

export const elementsSync = async () => {
	// Prevent concurrent syncs - if already running, skip this invocation
	if (syncInProgress) {
		console.info("Sync already in progress, skipping concurrent invocation");
		return;
	}

	syncInProgress = true;

	try {
		// clear old migration tables if present (not places_v4 which is current)
		clearTables(["elements", "elements_v2", "elements_v3"]);

		// Initialize progress to 1 to show loader immediately
		placesLoadingProgress.set(1);
		placesLoadingStatus.set("Initializing...");

		// get places and sync timestamp from local storage
		// readPlaceCache sanitizes at the trust boundary: a corrupt blob (the
		// #1187 class) reads as a cold cache and self-heals via re-download.
		const cachedPlaces = await readPlaceCache();
		const cachedSyncedAt = await readPlacesSyncedAt();

		await Promise.resolve(cachedPlaces)
			.then(async (cachedPlaces) => {
				// add to sync count to only show data refresh after initial load
				const count = get(placesSyncCount);
				placesSyncCount.set(count + 1);

				let placesData: Place[] = [];

				// Step 1: Get base data from static CDN if no cache exists
				if (!cachedPlaces) {
					try {
						placesLoadingStatus.set("Downloading places data...");
						placesLoadingProgress.set(PROGRESS_RANGES.DOWNLOAD_START);

						// Fetch as text to parse in worker
						const staticResponse = await api.get(
							"https://cdn.static.btcmap.org/api/v4/places.json",
							{
								responseType: "text",
								onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
									if (progressEvent.total) {
										const downloadPercent =
											(progressEvent.loaded / progressEvent.total) * 100;
										// Map 0-100% download to DOWNLOAD_START-DOWNLOAD_END range
										const downloadRange =
											PROGRESS_RANGES.DOWNLOAD_END -
											PROGRESS_RANGES.DOWNLOAD_START;
										const scaledProgress =
											PROGRESS_RANGES.DOWNLOAD_START +
											(downloadPercent / 100) * downloadRange;
										placesLoadingProgress.set(Math.round(scaledProgress));

										const loadedMB = (
											progressEvent.loaded /
											(1024 * 1024)
										).toFixed(1);
										const totalMB = (
											progressEvent.total /
											(1024 * 1024)
										).toFixed(1);
										placesLoadingStatus.set(
											`Downloading ${loadedMB} MB / ${totalMB} MB...`,
										);
									}
								},
							},
						);

						placesLoadingStatus.set("Processing places data...");
						placesLoadingProgress.set(PROGRESS_RANGES.PARSE_START);

						// Parse JSON in worker thread to avoid blocking main thread
						placesData = await parseJSON<Place[]>(
							staticResponse.data,
							"places",
							(progress) => {
								// Map 0-100% parsing to PARSE_START-PARSE_END range
								const parseRange =
									PROGRESS_RANGES.PARSE_END - PROGRESS_RANGES.PARSE_START;
								const scaledProgress =
									PROGRESS_RANGES.PARSE_START +
									(progress.percent / 100) * parseRange;
								placesLoadingProgress.set(Math.round(scaledProgress));

								if (progress.itemsParsed) {
									placesLoadingStatus.set(
										`Processing ${progress.itemsParsed.toLocaleString()} places...`,
									);
								}
							},
						);

						// Validate parsed data
						if (!Array.isArray(placesData) || placesData.length === 0) {
							console.error("CDN data parsing failed:", {
								isArray: Array.isArray(placesData),
								length: placesData?.length,
							});
							throw new Error("CDN data parsing returned invalid format");
						}

						console.info(
							`Successfully parsed ${placesData.length} places from CDN`,
						);

						placesLoadingProgress.set(PROGRESS_RANGES.PARSE_END);
					} catch (error) {
						placesError.set(
							"Could not load places from static CDN, please try again or contact BTC Map.",
						);
						placesLoadingStatus.set("");
						placesLoadingProgress.set(0);
						console.error(error);
						return;
					}
				} else {
					// Use cached data as base
					placesData = [...cachedPlaces];
					placesLoadingStatus.set("Loading from cache...");
					placesLoadingProgress.set(PROGRESS_RANGES.CACHE_LOAD);
				}

				// Step 2: Get recent updates from API
				// Prefer cached sync timestamp if available and valid (not in future, not older than
				// MAX_CACHE_AGE_DAYS); otherwise use static file date
				placesLoadingStatus.set("Checking for updates...");
				placesLoadingProgress.set(
					cachedPlaces
						? PROGRESS_RANGES.UPDATE_CHECK
						: PROGRESS_RANGES.UPDATE_CHECK_NO_CACHE,
				);

				// Validate cachedSyncedAt before using
				let validCachedSyncedAt: string | null = null;
				if (cachedSyncedAt) {
					if (isValidSyncDate(cachedSyncedAt)) {
						validCachedSyncedAt = cachedSyncedAt;
					} else {
						console.warn(
							`Cached sync date invalid (${cachedSyncedAt}), ignoring`,
						);
					}
				}

				const useCachedSyncTimestamp = cachedPlaces && validCachedSyncedAt;
				if (useCachedSyncTimestamp) {
					console.info(
						`Using cached sync timestamp for updates: ${validCachedSyncedAt}`,
					);
				}
				const updatesSince = useCachedSyncTimestamp
					? validCachedSyncedAt
					: await getStaticFileDate();

				let apiSucceeded = false;
				let mergedUpdateCount = 0;

				try {
					const apiResponse = await api.get<Place[]>(
						`${API_BASE}/v4/places?fields=${buildFieldsParam(PLACE_FIELD_SETS.MAP_SYNC)}&updated_since=${updatesSince}&include_deleted=true`,
					);

					const recentUpdates = apiResponse.data;

					// Validate response is actually an array
					if (!Array.isArray(recentUpdates)) {
						console.error(
							"API returned invalid data format:",
							typeof recentUpdates,
							recentUpdates,
						);
						throw new Error("API returned invalid data format");
					}

					console.info(
						`Fetched ${recentUpdates.length} updates from API since ${updatesSince}`,
					);

					if (recentUpdates.length > 0) {
						mergedUpdateCount = recentUpdates.length;
						placesLoadingStatus.set("Merging updates...");
						placesLoadingProgress.set(
							cachedPlaces
								? PROGRESS_RANGES.MERGE_START
								: PROGRESS_RANGES.MERGE_START_NO_CACHE,
						);

						// Use worker to filter and merge updates to avoid blocking main thread
						const updatedPlaceIds = recentUpdates.map((place) => place.id);
						// The details cache may still hold pre-update records for these
						// ids — evict them so the next drawer open refetches instead of
						// showing data the freshly-synced pins already contradict.
						for (const updatedId of updatedPlaceIds) {
							evictPlaceDetails(updatedId);
						}
						placesData = await filterPlaces(
							placesData,
							updatedPlaceIds,
							recentUpdates,
						);

						// Show refresh indicator if we got updates and had cached data
						if (cachedPlaces) {
							mapUpdates.set(true);
						}
					}

					apiSucceeded = true;
				} catch (error) {
					// If API fails, continue with existing data (either cached or CDN)
					// Don't return early - let execution continue to Step 3 to finalize and complete progress
					const errorMsg = cachedPlaces
						? "Could not update places from API, using cached data."
						: "Could not fetch recent updates. Showing baseline data from CDN.";
					placesError.set(errorMsg);
					console.error(error);
				}

				// Step 3: Save to local storage and update store
				placesLoadingStatus.set("Finalizing...");
				placesLoadingProgress.set(PROGRESS_RANGES.FINALIZE);

				// A periodic re-sync that merged nothing must NOT republish:
				// places.set notifies every subscriber (and bumps placesRevision)
				// even when the array is unchanged, sending ~50k rows back through
				// the map pipeline once per sync interval for no reason. Applies
				// ONLY to cache-based re-syncs: a CDN baseline download (no local
				// cache — e.g. after a failed persist) always publishes, since the
				// in-memory data may be older than the fresh baseline. The first
				// publication of the session (empty store) always goes through —
				// hydrating from the cache IS a change. The synced_at watermark
				// still advances so the update window stays minimal.
				const nothingChanged =
					cachedPlaces != null &&
					mergedUpdateCount === 0 &&
					get(places).length > 0;
				if (nothingChanged) {
					// Best-effort, matching the changed-data branch: a failed
					// watermark write must not trip the cache-load catch (and its
					// misleading toast + CDN fallback) — it just widens the next
					// update window.
					if (apiSucceeded) {
						await writePlacesSyncedAt(new Date().toISOString()).catch((err) =>
							console.warn("Could not save sync timestamp:", err),
						);
					}
					placesLoadingStatus.set("Complete!");
					placesLoadingProgress.set(PROGRESS_RANGES.COMPLETE);
				} else if (placesData.length > 0) {
					// publishPlaces always updates the store (the session keeps
					// working on broken storage); persistence failure surfaces via
					// the sync path's own error toast.
					const { persisted } = await publishPlaces(placesData);
					if (persisted) {
						// Only save sync timestamp if API succeeded, to avoid creating
						// gaps where updates between old and new timestamp are
						// permanently missed. Best-effort: a failed watermark write
						// just re-fetches a wider update window next sync.
						if (apiSucceeded) {
							await writePlacesSyncedAt(new Date().toISOString()).catch((err) =>
								console.warn("Could not save sync timestamp:", err),
							);
						}
						placesLoadingStatus.set("Complete!");
						placesLoadingProgress.set(PROGRESS_RANGES.COMPLETE);
						// Keep progress at 100% - don't reset to avoid confusing
						// loading states. The map component handles hiding the
						// indicator when elementsLoaded = true.
					} else {
						placesError.set(
							"Could not store places locally, please try again or contact BTC Map.",
						);
						placesLoadingStatus.set("");
						placesLoadingProgress.set(0);
					}
				} else {
					// placesData ended up empty (failed baseline download, or a
					// corrupt cache that sanitized away). Finalize instead of
					// stranding the status at "Finalizing..." with placesPublished
					// unlatched — but never persist an empty blob over whatever is
					// on disk; a healthy next sync re-downloads the baseline.
					await publishPlaces(placesData, { persist: false });
					placesLoadingStatus.set("Complete!");
					placesLoadingProgress.set(PROGRESS_RANGES.COMPLETE);
				}
			})
			.catch(async (err) => {
				placesError.set(
					"Could not load places locally, please try again or contact BTC Map.",
				);
				console.error(err);

				// Fallback: try to load from static CDN
				const count = get(placesSyncCount);
				placesSyncCount.set(count + 1);

				try {
					// Fetch as text to parse in worker
					const staticResponse = await api.get(
						"https://cdn.static.btcmap.org/api/v4/places.json",
						{
							responseType: "text",
						},
					);

					// Parse JSON in worker thread
					const parsedPlaces = await parseJSON<Place[]>(
						staticResponse.data,
						"places",
					);

					// Validate fallback CDN data
					if (!Array.isArray(parsedPlaces) || parsedPlaces.length === 0) {
						throw new Error("Fallback CDN data invalid");
					}

					if (parsedPlaces.length > 0) {
						// Publish-only: localforage already failed reading, so don't
						// bank on writing — matching the pre-existing behavior.
						await publishPlaces(parsedPlaces, { persist: false });
					}
				} catch (error) {
					placesError.set(
						"Could not load places from static CDN, please try again or contact BTC Map.",
					);
					console.error(error);
				}
			});
	} finally {
		syncInProgress = false;
	}
};

// Shared write-through for a single fresh place record: update localforage +
// $places, drop the record everywhere if it's deleted, and keep the details
// cache in $lib/placeDetails coherent. Returns the place, or null when it was
// deleted or no cache exists yet.
const applyPlaceUpdate = async (place: Place): Promise<Place | null> => {
	const cachedPlaces = await readPlaceCache();

	if (!cachedPlaces) {
		console.warn("No cached places found, cannot update place");
		return null;
	}

	// Check if place was deleted - remove from cache if present. Evicting the
	// details cache up front (before the fallible persist) is safe: eviction
	// is conservative — worst case is an extra refetch, never wrong data.
	if (place.deleted_at) {
		evictPlaceDetails(place.id);
		const updatedPlaces = cachedPlaces.filter((p) => p.id !== place.id);
		if (updatedPlaces.length !== cachedPlaces.length) {
			await publishPlaces(updatedPlaces);
			console.info(`Removed deleted place ${place.id} from cache`);
		}
		return null;
	}

	// Find and update the place in the array, or add it if missing
	const placeIndex = cachedPlaces.findIndex((p) => p.id === place.id);
	const updatedPlaces = [...cachedPlaces];
	if (placeIndex !== -1) {
		updatedPlaces[placeIndex] = place;
	} else {
		updatedPlaces.push(place);
	}

	// publishPlaces always updates the store, so the session shows the fresh
	// record even when the blob write fails (it just won't survive a reload)
	// — and the details cache can safely prime to match what $places shows.
	await publishPlaces(updatedPlaces);
	primePlaceDetails(place);
	return place;
};

export const updateSinglePlace = async (
	placeId: string | number,
): Promise<Place | null> => {
	try {
		// Fetch the updated place from the API
		const response = await api.get<Place>(completePlaceUrl(placeId));
		const updatedPlace = await applyPlaceUpdate(response.data);
		if (updatedPlace) {
			console.info(
				`Successfully updated place ${placeId} in localforage and store`,
			);
		}
		return updatedPlace;
	} catch (error) {
		console.error(`Failed to update single place ${placeId}:`, error);
		return null;
	}
};

export const updatePlaceInCache = async (
	place: Place,
): Promise<Place | null> => {
	// Runtime guard for SSR safety
	if (typeof window === "undefined") {
		console.warn("updatePlaceInCache called in SSR context");
		return null;
	}

	try {
		return await applyPlaceUpdate(place);
	} catch (error) {
		console.error(`Failed to update place ${place.id} in cache:`, error);
		return null;
	}
};
